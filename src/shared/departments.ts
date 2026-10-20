import { z } from "zod";

// NSU departments, grouped by school. Data only: edit the list here and the picker, the mod form and the
// API validators all follow. A faculty row stores the `code`. Names follow the title of each department's NSU
// faculty page ("Department of Accounting & Finance"); a department can be added or renamed here.

export type Department = { code: string; name: string; school: string };

export const DEPARTMENTS = [
  { code: "ARC", name: "Architecture", school: "SEPS" },
  { code: "CEE", name: "Civil and Environmental Engineering", school: "SEPS" },
  { code: "ECE", name: "Electrical and Computer Engineering", school: "SEPS" },
  { code: "DMP", name: "Mathematics & Physics", school: "SEPS" },
  { code: "ACF", name: "Accounting & Finance", school: "SBE" },
  { code: "ECO", name: "Economics", school: "SBE" },
  { code: "MGT", name: "Management", school: "SBE" },
  { code: "MKT", name: "Marketing & International Business", school: "SBE" },
  { code: "EML", name: "English and Modern Languages", school: "SHSS" },
  { code: "HIS", name: "History and Philosophy", school: "SHSS" },
  { code: "LAW", name: "Law", school: "SHSS" },
  { code: "MCJ", name: "Media, Communication and Journalism", school: "SHSS" },
  { code: "PSS", name: "Political Science and Sociology", school: "SHSS" },
  { code: "BBT", name: "Biochemistry and Biotechnology", school: "SHLS" },
  { code: "ESM", name: "Environmental Science and Management", school: "SHLS" },
  { code: "MIC", name: "Microbiology", school: "SHLS" },
  { code: "PHA", name: "Pharmaceutical Sciences", school: "SHLS" },
  { code: "PBH", name: "Public Health", school: "SHLS" },
] as const satisfies readonly Department[];

export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];

const CODES = DEPARTMENTS.map((d) => d.code) as [DepartmentCode, ...DepartmentCode[]];

export const departmentCode = z.enum(CODES, { error: "Pick a department" });

/** The department's full name, or the code itself for one no longer in the list. */
export function departmentName(code: string): string {
  return DEPARTMENTS.find((d) => d.code === code)?.name ?? code;
}
