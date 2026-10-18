import type { MiddlewareHandler } from "hono";
import type { AppEnv, Role } from "./types";

const ROLE_RANK: Record<Role, number> = { student: 0, mod: 1, admin: 2 };

/** Shown to a client that must change its temporary password before doing anything else. */
export const PASSWORD_CHANGE_REQUIRED = "password_change_required";

/**
 * Requires a signed-in user (401 otherwise). While `must_change_password` is set it answers 403,
 * so only routes that opt in with `requireUserAllowingPasswordChange` stay reachable.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (user.mustChangePassword) return c.json({ error: PASSWORD_CHANGE_REQUIRED }, 403);
  await next();
};

/** Same as `requireUser` but lets a user with `must_change_password` through. Use on change-password, me and logout only. */
export const requireUserAllowingPasswordChange: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return c.json({ error: "unauthorized" }, 401);
  await next();
};

/**
 * Requires at least `role` (student < mod < admin), so `requireRole("mod")` admits mods and admins.
 * Includes the `requireUser` checks, so it can be mounted on its own.
 */
export function requireRole(role: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    if (user.mustChangePassword) return c.json({ error: PASSWORD_CHANGE_REQUIRED }, 403);
    if (ROLE_RANK[user.role] < ROLE_RANK[role]) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}
