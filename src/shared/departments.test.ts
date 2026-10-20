import { describe, expect, it } from "vite-plus/test";
import { DEPARTMENTS, departmentCode, departmentName } from "./departments.ts";

describe("departments", () => {
  it("has unique codes and names", () => {
    const codes = DEPARTMENTS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    const names = DEPARTMENTS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("splits biochemistry from microbiology and lists media and journalism", () => {
    expect(departmentName("BBT")).toBe("Biochemistry and Biotechnology");
    expect(departmentName("MIC")).toBe("Microbiology");
    expect(departmentName("MCJ")).toBe("Media, Communication and Journalism");
    expect(departmentCode.safeParse("BMB").success).toBe(false);
  });

  it("falls back to the code for one no longer listed", () => {
    expect(departmentName("ZZZ")).toBe("ZZZ");
  });
});
