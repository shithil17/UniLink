import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { users } from "../db/schema";

export type NewUser = typeof users.$inferInsert;
export type UserRow = typeof users.$inferSelect;

export function usersRepo(db: Db) {
  return {
    async create(user: NewUser): Promise<UserRow> {
      return db.insert(users).values(user).returning().get();
    },
    async findById(id: number): Promise<UserRow | null> {
      return (await db.select().from(users).where(eq(users.id, id)).get()) ?? null;
    },
    async findByUsername(username: string): Promise<UserRow | null> {
      return (await db.select().from(users).where(eq(users.username, username)).get()) ?? null;
    },
  };
}
