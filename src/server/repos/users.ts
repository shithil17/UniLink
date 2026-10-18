import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { users } from "../db/schema";
import type { StoredPassword } from "../password";

export type NewUser = typeof users.$inferInsert;
export type UserRow = typeof users.$inferSelect;

export type CreateUserResult =
  | { ok: true; user: UserRow }
  | { ok: false; conflict: "username" | "student_key" };

function passwordColumns(p: StoredPassword) {
  return {
    passwordHash: p.hash,
    passwordSalt: p.salt,
    passwordAlgo: p.algo,
    passwordIterations: p.iterations,
  };
}

/** D1 reports which column broke a UNIQUE constraint in the (possibly wrapped) error message. */
function uniqueConflict(err: unknown): "username" | "student_key" | null {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (/UNIQUE constraint failed: users\.student_key/i.test(e.message)) return "student_key";
    if (/UNIQUE constraint failed: users\.username/i.test(e.message)) return "username";
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
  };
}
