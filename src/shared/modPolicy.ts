export type Role = "student" | "mod" | "admin";

// Shared so the server enforces the rule and the mod panel only offers actions that will be accepted.

/**
 * Who a moderation action (ban, unban, password reset, key release, role change) may be used on:
 *
 * - Nobody acts on themselves.
 * - Nobody acts on an admin through the API. Admin accounts change in the database only.
 * - A mod acts on students only. Mods never act on other mods: only admins manage mods.
 * - An admin acts on students and mods.
 */
export function canActOn(
  actor: { id: number; role: Role },
  target: { id: number; role: Role },
): boolean {
  if (actor.id === target.id) return false;
  if (target.role === "admin") return false;
  if (actor.role === "admin") return true;
  return actor.role === "mod" && target.role === "student";
}
