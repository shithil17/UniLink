import type { Me } from "../../shared/schemas/auth";

type Role = Me["role"];

export type MainTab = {
  to: "/" | "/courses" | "/resources" | "/routine" | "/inbox" | "/mod" | "/settings";
  label: string;
  /** On the phone tab bar. The rest sit in the bar's More sheet; the desktop rail shows them all. */
  inBar: boolean;
  /** One plain line under the label in the More sheet. */
  hint?: string;
};

const homeTab: MainTab = { to: "/", label: "Home", inBar: true };
const coursesTab: MainTab = { to: "/courses", label: "Courses", inBar: true };
const materialsTab: MainTab = { to: "/resources", label: "Materials", inBar: true };
const routineTab: MainTab = {
  to: "/routine",
  label: "Routine",
  inBar: false,
  hint: "Your classes for the week",
};
const inboxTab: MainTab = { to: "/inbox", label: "Inbox", inBar: true };
const modTab: MainTab = {
  to: "/mod",
  label: "Mod",
  inBar: false,
  hint: "Held posts, users and curriculum",
};
const settingsTab: MainTab = {
  to: "/settings",
  label: "Settings",
  inBar: false,
  hint: "Theme, password and account",
};

/**
 * Every top-level destination, in rail order. Signed-out users and anyone forced to change their
 * password get none: every tab would just bounce them back, so the shell shows the wordmark only.
 *
 * ceiling: the phone bar holds four tabs plus More, so a fifth daily destination has to replace one
 * (Home already shows today's classes, which is why Routine moved to More). New destinations go
 * into More. Revisit if More grows past about six rows or usage shows a More item opened daily.
 */
export function mainTabs(
  user: { role: Role; mustChangePassword: boolean } | null | undefined,
): MainTab[] {
  if (!user || user.mustChangePassword) return [];
  return user.role === "student"
    ? [homeTab, coursesTab, materialsTab, routineTab, inboxTab, settingsTab]
    : [homeTab, coursesTab, materialsTab, routineTab, inboxTab, modTab, settingsTab];
}

function isInside(to: MainTab["to"], pathname: string) {
  // Matches the router's own active test: Home only on "/", every other tab on its path and below.
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

/** The tab the pathname is inside, if any (a screen such as change password has none). */
export function activeTab(tabs: readonly MainTab[], pathname: string): MainTab | undefined {
  return tabs.find(({ to }) => isInside(to, pathname));
}

/**
 * The slot the phone bar's sliding pill sits in: a bar tab's position, the More slot (after the bar
 * tabs) for a tab that lives in the More sheet, or -1 when no tab is active.
 */
export function barPillIndex(tabs: readonly MainTab[], pathname: string): number {
  const bar = tabs.filter((t) => t.inBar);
  const active = activeTab(tabs, pathname);
  if (!active) return -1;
  return active.inBar ? bar.indexOf(active) : bar.length;
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

/** The screens that use the split auth layout from `lg`: the shell then lets them run edge to edge. */
export function isSplitAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}
