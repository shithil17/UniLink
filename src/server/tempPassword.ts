import { randomBytes } from "./crypto";
import { limits } from "./limits";

// 32 characters, so one random byte masked to 5 bits picks one with no bias. Leaves out 0, 1, I and O
// (easy to misread when a mod reads it out or types it into a message).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random temporary password for a mod-assisted reset. Shown once to the mod, never stored in clear. */
export function generateTemporaryPassword(length: number = limits.tempPasswordLength): string {
  return Array.from(randomBytes(length), (b) => ALPHABET[b & 31]).join("");
}
