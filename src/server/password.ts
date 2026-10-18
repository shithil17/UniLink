import { fromBase64, randomBytes, timingSafeEqual, toBase64 } from "./crypto";
import { limits } from "./limits";

export const PBKDF2_SHA256 = "pbkdf2-sha256";
const HASH_BITS = 256;

/** What the `users` table stores for a password. */
export type StoredPassword = {
  hash: string;
  salt: string;
  algo: string;
  iterations: number;
};

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  iterations: number = limits.pbkdf2Iterations,
): Promise<StoredPassword> {
  const salt = randomBytes(limits.passwordSaltBytes);
  const hash = await derive(password, salt, iterations);
  return { hash: toBase64(hash), salt: toBase64(salt), algo: PBKDF2_SHA256, iterations };
}

export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  if (stored.algo !== PBKDF2_SHA256) return false;
  const actual = await derive(password, fromBase64(stored.salt), stored.iterations);
  return timingSafeEqual(actual, fromBase64(stored.hash));
}

/** True when a stored hash should be re-hashed with the current settings after a successful login. */
export function needsRehash(stored: StoredPassword): boolean {
  return stored.algo !== PBKDF2_SHA256 || stored.iterations !== limits.pbkdf2Iterations;
}
