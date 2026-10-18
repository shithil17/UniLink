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
