import { describe, expect, it } from "vite-plus/test";
import { canActOn } from "./modPolicy";

const student = { id: 1, role: "student" } as const;
const mod = { id: 2, role: "mod" } as const;
const otherMod = { id: 3, role: "mod" } as const;
const admin = { id: 4, role: "admin" } as const;
const otherAdmin = { id: 5, role: "admin" } as const;

describe("canActOn()", () => {
  it("lets a mod act on students only", () => {
    expect(canActOn(mod, student)).toBe(true);
    expect(canActOn(mod, otherMod)).toBe(false);
    expect(canActOn(mod, admin)).toBe(false);
  });

  it("lets an admin act on students and mods, never on another admin", () => {
    expect(canActOn(admin, student)).toBe(true);
    expect(canActOn(admin, mod)).toBe(true);
    expect(canActOn(admin, otherAdmin)).toBe(false);
  });

  it("never lets anyone act on themselves", () => {
    expect(canActOn(mod, mod)).toBe(false);
    expect(canActOn(admin, admin)).toBe(false);
  });

  it("gives a student no powers", () => {
    expect(canActOn(student, { id: 9, role: "student" })).toBe(false);
  });
});
