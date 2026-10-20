import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { users } from "../db/schema";
import { limits } from "../limits";
import type { StoredPassword } from "../password";

export type NewUser = typeof users.$inferInsert;
export type UserRow = typeof users.$inferSelect;

export type CreateUserResult = { ok: true; user: UserRow } | { ok: false; conflict: UniqueColumn };

/** What mods may see of a user: never the student ID, email or full name. */
export type ModUserRow = Pick<
  UserRow,
  "id" | "username" | "role" | "bannedAt" | "mustChangePassword" | "createdAt"
>;

/** The ID-conflict tool is the one place a student ID leaves the database. */
export type IdHolderRow = ModUserRow & Pick<UserRow, "studentKey" | "studentSuffix">;

/** The columns a moderation action changes on a user, and so the shape of a reversal snapshot. */
export type UserState = Pick<UserRow, "role" | "bannedAt" | "studentKey">;

/** A released student ID key is replaced by this prefix plus the user id, which no real 7-digit key can equal. */
export const RELEASED_KEY_PREFIX = "released:";

const modUserColumns = {
  id: users.id,
  username: users.username,
  role: users.role,
  bannedAt: users.bannedAt,
  mustChangePassword: users.mustChangePassword,
  createdAt: users.createdAt,
};

type UniqueColumn = "username" | "student_key" | "email";

function passwordColumns(p: StoredPassword) {
  return {
    passwordHash: p.hash,
    passwordSalt: p.salt,
    passwordAlgo: p.algo,
    passwordIterations: p.iterations,
  };
}

/** D1 reports which column broke a UNIQUE constraint in the (possibly wrapped) error message. */
function uniqueConflict(err: unknown): UniqueColumn | null {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    const column = /UNIQUE constraint failed: users\.(student_key|username|email)/i.exec(e.message);
    if (column) return column[1].toLowerCase() as UniqueColumn;
  }
  return null;
}

export function usersRepo(db: Db) {
  return {
    async create(user: NewUser): Promise<UserRow> {
      return db.insert(users).values(user).returning().get();
    },
    /** Like `create`, but turns a unique-constraint failure (a signup race) into a result. */
    async createUnique(user: NewUser): Promise<CreateUserResult> {
      try {
        return { ok: true, user: await db.insert(users).values(user).returning().get() };
      } catch (err) {
        const conflict = uniqueConflict(err);
        if (conflict) return { ok: false, conflict };
        throw err;
      }
    },
    async findById(id: number): Promise<UserRow | null> {
      return (await db.select().from(users).where(eq(users.id, id)).get()) ?? null;
    },
    /** `username` must already be lowercased: the stored value is lowercase. */
    async findByUsername(username: string): Promise<UserRow | null> {
      return (await db.select().from(users).where(eq(users.username, username)).get()) ?? null;
    },
    async studentKeyExists(studentKey: string): Promise<boolean> {
      const row = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.studentKey, studentKey))
        .get();
      return row !== undefined;
    },
    /** `email` must already be lowercased: the stored value is lowercase. */
    async emailExists(email: string): Promise<boolean> {
      const row = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
      return row !== undefined;
    },
    /** Replaces the password hash, optionally clearing `must_change_password`. */
    async updatePassword(
      id: number,
      password: StoredPassword,
      opts: { clearMustChange?: boolean } = {},
    ) {
      await db
        .update(users)
        .set({
          ...passwordColumns(password),
          ...(opts.clearMustChange ? { mustChangePassword: false } : {}),
        })
        .where(eq(users.id, id));
    },
    /**
     * One page of users for the mod panel, newest first. `prefix` matches the start of the username.
     * ceiling: the prefix is a range scan on the unique username index, which relies on usernames
     * being [a-z0-9_] only ('{' sorts after 'z'). Revisit if usernames ever allow other characters.
     */
    async listForMods(opts: {
      prefix?: string;
      beforeId: number | null;
      limit: number;
    }): Promise<ModUserRow[]> {
      return db
        .select(modUserColumns)
        .from(users)
        .where(
          and(
            opts.prefix === undefined
              ? undefined
              : and(gte(users.username, opts.prefix), lt(users.username, `${opts.prefix}{`)),
            opts.beforeId === null ? undefined : lt(users.id, opts.beforeId),
          ),
        )
        .orderBy(desc(users.id))
        .limit(opts.limit)
        .all();
    },
    async findForMods(id: number): Promise<ModUserRow | null> {
      return (await db.select(modUserColumns).from(users).where(eq(users.id, id)).get()) ?? null;
    },
    /** The ID-conflict lookup: the account holding a 7-digit key. */
    async findByStudentKey(studentKey: string): Promise<IdHolderRow | null> {
      return (
        (await db
          .select({
            ...modUserColumns,
            studentKey: users.studentKey,
            studentSuffix: users.studentSuffix,
          })
          .from(users)
          .where(eq(users.studentKey, studentKey))
          .get()) ?? null
      );
    },
    /** The columns a moderation action can change, for a snapshot. */
    async findState(id: number): Promise<UserState | null> {
      return (
        (await db
          .select({ role: users.role, bannedAt: users.bannedAt, studentKey: users.studentKey })
          .from(users)
          .where(eq(users.id, id))
          .get()) ?? null
      );
    },
    /** Public handles for ids, for labels. Ids that no longer exist are missing from the map. */
    async usernamesByIds(ids: number[]): Promise<Map<number, string>> {
      const found = new Map<number, string>();
      const unique = [...new Set(ids)];
      // Chunked to stay under D1's bound-parameter cap.
      for (let i = 0; i < unique.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, unique.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) found.set(r.id, r.username);
      }
      return found;
    },
    /** Bans a user who is not banned. False when they already are (or do not exist). */
    async ban(id: number, now: number): Promise<boolean> {
      const rows = await db
        .update(users)
        .set({ bannedAt: now })
        .where(and(eq(users.id, id), isNull(users.bannedAt)))
        .returning({ id: users.id });
      return rows.length > 0;
    },
    /** Lifts a ban. False when the user is not banned (or does not exist). */
    async unban(id: number): Promise<boolean> {
      const rows = await db
        .update(users)
        .set({ bannedAt: null })
        .where(and(eq(users.id, id), isNotNull(users.bannedAt)))
        .returning({ id: users.id });
      return rows.length > 0;
    },
    /** Changes the role only if it is still `from`, so two admins cannot both apply a stale change. */
    async setRole(id: number, from: UserRow["role"], to: UserRow["role"]): Promise<boolean> {
      const rows = await db
        .update(users)
        .set({ role: to })
        .where(and(eq(users.id, id), eq(users.role, from)))
        .returning({ id: users.id });
      return rows.length > 0;
    },
    /**
     * Frees the holder's student ID key for its real owner: the key becomes a tombstone and the
     * account is banned (kept if already banned). False if the key is no longer `expectedKey`.
     */
    async releaseKey(id: number, expectedKey: string, now: number): Promise<boolean> {
      const rows = await db
        .update(users)
        .set({
          studentKey: `${RELEASED_KEY_PREFIX}${id}`,
          bannedAt: sql`coalesce(${users.bannedAt}, ${now})`,
        })
        .where(and(eq(users.id, id), eq(users.studentKey, expectedKey)))
        .returning({ id: users.id });
      return rows.length > 0;
    },
    /** A mod-issued temporary password: new hash and the flag that forces a change at next login. */
    async setTemporaryPassword(id: number, password: StoredPassword) {
      await db
        .update(users)
        .set({ ...passwordColumns(password), mustChangePassword: true })
        .where(eq(users.id, id));
    },
    /**
     * The update that puts a snapshot back (not run here, so a reversal can batch it with its audit
     * row). Only the columns in the snapshot are written.
     */
    restoreStatement(id: number, snapshot: Partial<UserState>) {
      return db.update(users).set(snapshot).where(eq(users.id, id));
    },
  };
}
