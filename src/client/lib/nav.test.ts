import { describe, expect, it } from "vite-plus/test";
import {
  activeModSection,
  activeTab,
  barPillIndex,
  isSplitAuthPath,
  mainTabs,
  modSectionsFor,
} from "./nav";

const student = { role: "student", mustChangePassword: false } as const;

const modUser = { role: "mod", mustChangePassword: false } as const;
const labels = (tabs: { label: string }[]) => tabs.map((t) => t.label);

describe("mainTabs", () => {
  it("puts Materials in the phone bar and Rides, Routine and Settings in More for a student", () => {
    const tabs = mainTabs(student);
    expect(labels(tabs.filter((t) => t.inBar))).toEqual(["Home", "Courses", "Materials", "Inbox"]);
    expect(labels(tabs.filter((t) => !t.inBar))).toEqual(["Rides", "Routine", "Settings"]);
  });

  it("gives mods and admins a Mod tab in More, and keeps their Routine", () => {
    for (const role of ["mod", "admin"] as const) {
      const tabs = mainTabs({ role, mustChangePassword: false });
      expect(labels(tabs.filter((t) => t.inBar))).toEqual([
        "Home",
        "Courses",
        "Materials",
        "Inbox",
      ]);
      expect(labels(tabs.filter((t) => !t.inBar))).toEqual(["Rides", "Routine", "Mod", "Settings"]);
    }
  });

  it("gives every More tab a hint for the sheet", () => {
    for (const tab of mainTabs(modUser).filter((t) => !t.inBar)) expect(tab.hint).toBeTruthy();
  });

  it("shows no tabs when signed out or while a temporary password is set", () => {
    expect(mainTabs(null)).toEqual([]);
    expect(mainTabs(undefined)).toEqual([]);
    expect(mainTabs({ role: "student", mustChangePassword: true })).toEqual([]);
  });
});

describe("modSectionsFor", () => {
  it("gives mods and admins the Areas section", () => {
    for (const role of ["mod", "admin"] as const) {
      expect(modSectionsFor(role).map((s) => s.to)).toContain("/mod/areas");
    }
  });

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

describe("activeTab", () => {
  it("keeps a tab active below its path, and never lets Home match everything", () => {
    expect(activeTab(mainTabs(student), "/courses/CSE115")?.label).toBe("Courses");
    expect(activeTab(mainTabs(student), "/resources/12")?.label).toBe("Materials");
    expect(activeTab(mainTabs(student), "/rides/12/edit")?.label).toBe("Rides");
    expect(activeTab(mainTabs(student), "/coursesx")).toBeUndefined();
    expect(activeTab(mainTabs(student), "/change-password")).toBeUndefined();
  });
});

describe("barPillIndex", () => {
  it("is a bar tab's position in the phone bar", () => {
    expect(barPillIndex(mainTabs(student), "/")).toBe(0);
    expect(barPillIndex(mainTabs(student), "/resources/new")).toBe(2);
    expect(barPillIndex(mainTabs(modUser), "/inbox")).toBe(3);
  });

  it("sits on the More slot, after the bar tabs, for a tab in More", () => {
    expect(barPillIndex(mainTabs(student), "/rides")).toBe(4);
    expect(barPillIndex(mainTabs(student), "/routine")).toBe(4);
    expect(barPillIndex(mainTabs(student), "/settings")).toBe(4);
    expect(barPillIndex(mainTabs(modUser), "/mod/queue")).toBe(4);
  });

  it("is -1 on a screen with no tab, or with no tabs at all", () => {
    expect(barPillIndex(mainTabs(student), "/change-password")).toBe(-1);
    expect(barPillIndex(mainTabs(null), "/")).toBe(-1);
  });
});

describe("isSplitAuthPath", () => {
  it.each([
    ["/login", true],
    ["/signup", true],
    ["/change-password", false],
    ["/", false],
    ["/login/extra", false],
  ])("%s -> %s", (path, expected) => {
    expect(isSplitAuthPath(path)).toBe(expected);
  });
});
