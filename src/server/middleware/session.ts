import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getDb } from "../db/client";
import { limits } from "../limits";
import { sessionsRepo } from "../repos/sessions";
import { hashSessionToken } from "../sessionToken";
import type { AppEnv } from "./types";

export const SESSION_COOKIE = "unilink_session";

export function setSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(limits.sessionTtlMs / 1000),
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}

/**
 * Loads the user for the session cookie into `c.var.user` (null when signed out).
 * Looks up the SHA-256 hash of the token. Expired sessions and banned users are treated as signed out.
 * Mount once, before any route that reads `c.var.user`.
 */
export const sessionLoader: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const repo = sessionsRepo(getDb(c.env.DB));
    const found = await repo.findByTokenHash(await hashSessionToken(token));
    if (found) {
      if (found.expiresAt <= Date.now()) {
        await repo.deleteById(found.sessionId);
      } else if (found.user.bannedAt === null) {
        const { user } = found;
        c.set("user", {
          id: user.id,
          username: user.username,
          role: user.role,
          admissionYear: user.admissionYear,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt,
          sessionId: found.sessionId,
        });
      }
    }
  }
  await next();
};
