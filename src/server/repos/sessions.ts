import { eq, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";

/** A session joined to its user, as the session loader needs it. */
export type SessionWithUser = {
  sessionId: number;
  expiresAt: number;
  user: {
    id: number;
    username: string;
    role: "student" | "mod" | "admin";
    admissionYear: number;
    mustChangePassword: boolean;
    bannedAt: number | null;
    createdAt: number;
  };
};

export function sessionsRepo(db: Db) {
  return {
    async create(input: {
      userId: number;
      tokenHash: string;
      createdAt: number;
      expiresAt: number;
    }) {
      await db.insert(sessions).values(input);
    },
    async findByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
      const row = await db
        .select({
          sessionId: sessions.id,
          expiresAt: sessions.expiresAt,
          user: {
            id: users.id,
            username: users.username,
            role: users.role,
            admissionYear: users.admissionYear,
            mustChangePassword: users.mustChangePassword,
            bannedAt: users.bannedAt,
            createdAt: users.createdAt,
          },
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, tokenHash))
        .get();
      return row ?? null;
    },
    async deleteById(id: number) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },
    async deleteByTokenHash(tokenHash: string) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
    /** Logout everywhere: used on password change and ban. */
    async deleteAllForUser(userId: number) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },
    async deleteExpired(now: number) {
      await db.delete(sessions).where(lt(sessions.expiresAt, now));
    },
  };
}
