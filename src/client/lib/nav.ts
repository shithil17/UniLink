import type { Me } from "../../shared/schemas/auth";

type Role = Me["role"];

export type MainTab = { to: "/" | "/courses" | "/inbox" | "/mod" | "/settings"; label: string };

const baseTabs: readonly MainTab[] = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/inbox", label: "Inbox" },
];

/**
 * The top-level destinations, in bar order. Signed-out users and anyone forced to change their
 * password get none: every tab would just bounce them back, so the shell shows the wordmark only.
 * Mods and admins get a fifth tab for the moderation panel, which keeps the bar at five or fewer.
 */
export function mainTabs(
  user: { role: Role; mustChangePassword: boolean } | null | undefined,
): MainTab[] {
  if (!user || user.mustChangePassword) return [];
  const mod: MainTab[] = user.role === "student" ? [] : [{ to: "/mod", label: "Mod" }];
  return [...baseTabs, ...mod, { to: "/settings", label: "Settings" }];
}

export type ModSection = {
  to:
    | "/mod/queue"
    | "/mod/users"
    | "/mod/faculty"
    | "/mod/courses"
    | "/mod/id-conflict"
    | "/mod/audit"
    | "/mod/import";
  /** The short name used in the tab row and as the switcher's current value. */
  label: string;
  /** One plain line for the phone menu, where the short names alone are not self-explanatory. */
  hint: string;
  adminOnly?: boolean;
};

const modSections: readonly ModSection[] = [
  { to: "/mod/queue", label: "Queue", hint: "Held posts and reports" },
  { to: "/mod/users", label: "Users", hint: "Search, ban and reset passwords" },
  { to: "/mod/faculty", label: "Faculty", hint: "The directory of faculty members" },
  { to: "/mod/courses", label: "Courses", hint: "Curriculum courses and electives" },
  { to: "/mod/id-conflict", label: "ID check", hint: "Look into a student ID conflict" },
  { to: "/mod/audit", label: "Audit log", hint: "Every action, with reverse", adminOnly: true },
  { to: "/mod/import", label: "Import", hint: "Load a curriculum file" },
];

/** The moderation sections this role may open. Admins see the audit log; mods do not. */
export function modSectionsFor(role: Role | undefined): ModSection[] {
  return modSections.filter((section) => !section.adminOnly || role === "admin");
}

/** The section the pathname is inside, if any. */
export function activeModSection(pathname: string, sections: readonly ModSection[]) {
  return sections.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`));
}
