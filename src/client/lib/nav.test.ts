import { describe, expect, it } from "vite-plus/test";
import { activeModSection, activeTabIndex, mainTabs, modSectionsFor } from "./nav";

const student = { role: "student", mustChangePassword: false } as const;

describe("mainTabs", () => {
  it("gives a student five tabs, with Routine and no Mod tab", () => {
    expect(mainTabs(student).map((t) => t.label)).toEqual([
      "Home",
      "Courses",
      "Routine",
      "Inbox",
      "Settings",
    ]);
  });

  it("gives mods and admins the Mod tab in the Routine tab's place, so the bar stays at five", () => {
    for (const role of ["mod", "admin"] as const) {
      expect(mainTabs({ role, mustChangePassword: false }).map((t) => t.label)).not.toContain(
        "Routine",
      );
    }
  });

  it("adds the Mod tab for mods and admins, and stays within five", () => {
    for (const role of ["mod", "admin"] as const) {
      const tabs = mainTabs({ role, mustChangePassword: false });
      expect(tabs.map((t) => t.label)).toContain("Mod");
      expect(tabs.length).toBeLessThanOrEqual(5);
    }
  });

  it("shows no tabs when signed out or while a temporary password is set", () => {
    expect(mainTabs(null)).toEqual([]);
    expect(mainTabs(undefined)).toEqual([]);
    expect(mainTabs({ role: "student", mustChangePassword: true })).toEqual([]);
  });
});

describe("modSectionsFor", () => {
  it("hides the audit log from mods but not admins", () => {
    expect(modSectionsFor("mod").map((s) => s.to)).not.toContain("/mod/audit");
    expect(modSectionsFor("admin").map((s) => s.to)).toContain("/mod/audit");
  });
});

describe("activeModSection", () => {
  const sections = modSectionsFor("admin");

  it("finds the section a path is in, including nested paths", () => {
    expect(activeModSection("/mod/faculty", sections)?.label).toBe("Faculty");
    expect(activeModSection("/mod/faculty/12", sections)?.label).toBe("Faculty");
  });

  it("does not match a path that only shares a prefix, or a hidden section", () => {
    expect(activeModSection("/mod/facultyx", sections)).toBeUndefined();
    expect(activeModSection("/mod/audit", modSectionsFor("mod"))).toBeUndefined();
  });
});

describe("activeTabIndex", () => {
  const modUser = { role: "mod", mustChangePassword: false } as const;

  it("is the tab's position in the bar, so the pill follows the role's tab list", () => {
    expect(activeTabIndex(mainTabs(student), "/")).toBe(0);
    expect(activeTabIndex(mainTabs(student), "/routine")).toBe(2);
    expect(activeTabIndex(mainTabs(student), "/settings")).toBe(4);
    expect(activeTabIndex(mainTabs(modUser), "/inbox")).toBe(2);
    expect(activeTabIndex(mainTabs(modUser), "/mod/queue")).toBe(3);
  });

  it("keeps a tab active below its path, and never lets Home match everything", () => {
    expect(activeTabIndex(mainTabs(student), "/courses/CSE115")).toBe(1);
    expect(activeTabIndex(mainTabs(student), "/coursesx")).toBe(-1);
  });

  it("is -1 on a screen with no tab, or with no tabs at all", () => {
    expect(activeTabIndex(mainTabs(modUser), "/routine")).toBe(-1);
    expect(activeTabIndex(mainTabs(null), "/")).toBe(-1);
  });
});
