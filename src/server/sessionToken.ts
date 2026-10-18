import { randomBytes, sha256Hex, toHex } from "./crypto";
import { limits } from "./limits";

/** A new random session token (hex) for the cookie. Only its hash is stored. */
export function generateSessionToken(): string {
  return toHex(randomBytes(limits.sessionTokenBytes));
}

export function hashSessionToken(token: string): Promise<string> {
  return sha256Hex(token);
}
