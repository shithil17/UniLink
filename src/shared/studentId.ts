// Student ID format YY S IIII SSS: admission year, semester digit (1 to 3), serial, then 042 or 642.
// The first 7 digits are the unique key, the last 3 are the suffix, the first 2 select the curriculum.

export const STUDENT_ID_PATTERN = /^\d{2}[123]\d{4}(042|642)$/;

export type ParsedStudentId = {
  /** First 7 digits. One account per key. */
  key: string;
  /** Last 3 digits: 042 or 642. */
  suffix: string;
  /** First 2 digits as a number (YY, e.g. 22). */
  admissionYear: number;
};

/** Removes spaces and dashes, so "221 2345 042" and "221-2345-042" compare equal. */
export function normalizeStudentId(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function isValidStudentId(raw: string): boolean {
  return STUDENT_ID_PATTERN.test(normalizeStudentId(raw));
}

/** Returns null when the ID is not valid. */
export function parseStudentId(raw: string): ParsedStudentId | null {
  const id = normalizeStudentId(raw);
  if (!STUDENT_ID_PATTERN.test(id)) return null;
  return { key: id.slice(0, 7), suffix: id.slice(7), admissionYear: Number(id.slice(0, 2)) };
}
