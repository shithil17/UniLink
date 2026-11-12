import type { Db } from "../db/client";
import { sessionsRepo } from "../repos/sessions";
import { usersRepo, type NewUser } from "../repos/users";
import { generateSessionToken, hashSessionToken } from "../sessionToken";

let counter = 0;

/** Inserts a user with placeholder password fields (no hashing, so tests stay fast). */
export async function createTestUser(db: Db, overrides: Partial<NewUser> = {}) {
  counter += 1;
  const n = String(counter).padStart(4, "0");
  return usersRepo(db).create({
    username: `user${n}`,
    studentKey: `221${n}`,
    studentSuffix: "042",
    admissionYear: 22,
    passwordHash: "x",
    passwordSalt: "x",
    passwordAlgo: "pbkdf2-sha256",
    passwordIterations: 1,
    createdAt: Date.now(),
    ...overrides,
  });
}

/** Creates a session for the user and returns the raw cookie token. */
export async function createTestSession(
  db: Db,
  userId: number,
  overrides: { createdAt?: number; expiresAt?: number } = {},
) {
  const token = generateSessionToken();
  const createdAt = overrides.createdAt ?? Date.now();
  await sessionsRepo(db).create({
    userId,
    tokenHash: await hashSessionToken(token),
    createdAt,
    expiresAt: overrides.expiresAt ?? createdAt + 60_000,
  });
  return token;
}

/** The areas migration 0020 seeds; ids 1 to this many are the shipped list. */
export const SEEDED_AREA_COUNT = 95;

/**
 * Puts the areas table back to the seed: removes areas a test added (rides that use them must be gone
 * already), shows every area again and restores the seeded names. Call it after clearing `rides`.
 */
export async function resetAreas(d1: D1Database) {
  await d1.prepare("DELETE FROM areas WHERE id > ?").bind(SEEDED_AREA_COUNT).run();
  await d1.prepare("UPDATE areas SET hidden = 0, hidden_reason = NULL").run();
}

/** The id of a seeded or added area, by its slug. */
export async function areaIdBySlug(d1: D1Database, slug: string): Promise<number> {
  const row = await d1
    .prepare("SELECT id FROM areas WHERE slug = ?")
    .bind(slug)
    .first<{ id: number }>();
  if (!row) throw new Error(`no area with slug ${slug}`);
  return row.id;
}
