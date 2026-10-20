import { describe, expect, it } from "vite-plus/test";
import { activeModSection, mainTabs, modSectionsFor } from "./nav";

const student = { role: "student", mustChangePassword: false } as const;

describe("mainTabs", () => {
  it("gives a student four tabs and no Mod tab", () => {
    expect(mainTabs(student).map((t) => t.label)).toEqual(["Home", "Courses", "Inbox", "Settings"]);
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
