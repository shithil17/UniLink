import { dhakaYear } from "./time.ts";

// Student ID format YY S IIII V PP: admission year, semester digit (1 to 3), serial, then the
// verification digit (0 = documents verified, 6 = not yet) and the two-digit program code.
// The first 7 digits are the unique key, the last 3 are the suffix, the first 2 select the curriculum.

export const STUDENT_ID_PATTERN = /^(\d{2})[123]\d{4}([06])(\d{2})$/;

/** NSU program codes (the last two digits of a student ID). */
export const NSU_PROGRAM_CODES: Readonly<Record<string, string>> = {
  // Undergraduate
  "10": "Bachelor of Architecture",
  "11": "Bachelor of Laws (LLB Hons)",
  "12": "BSS in Media, Communication, and Journalism",
  "13": "Bachelor of Social Science in Anthropology",
  "14": "Bachelor of Social Science in Sociology",
  "15": "BA in English",
  "16": "BSS in History & Global Studies",
  "18": "Bachelor of Public Health",
  "20": "BS in Economics",
  "25": "BS in Civil & Environmental Engineering",
  "26": "BS in Environmental Science",
  "27": "BS in Environmental Management",
  "30": "Bachelor of Business Administration",
  "42": "BS in Computer Science & Engineering",
  "43": "BS in Electrical and Electronics Engineering",
  "46": "Bachelor of Pharmacy",
  "47": "BS in Biochemistry and Biotechnology",
  "48": "BS in Microbiology",
  // Graduate
  "50": "MS in Computer Science and Engineering",
  "51": "Master in Development Studies",
  "52": "MS in Electrical and Electronic Engineering",
  "53": "MS in Economics",
  "54": "Master of Laws (LL.M)",
  "55": "MA in English",
  "56": "MS in Electronic and Telecommunication Engineering",
  "57": "MA in History and Asian Studies",
  "58": "MS in Applied Mathematics and Computational Sciences",
  "60": "Master of Business Administration",
  "65": "MS in Civil Engineering",
  "70": "MS in Biotechnology",
  "72": "MPharm in Pharmacology and Clinical Pharmacy",
  "73": "MPharm in Pharmaceutical Technology and Biopharmaceutics",
  "76": "MS in Environmental Science and Management",
  "80": "Master of Public Health",
  "81": "Executive Master of Public Health",
  "85": "Master in Public Policy and Governance",
  "86": "Executive Masters in Policy and Governance",
  "90": "Executive Master of Business Administration",
};

// Shared with the client form, so it lives here rather than in the server-only `limits.ts`.
// ceiling: IDs older than this are treated as graduated or made up. Revisit if current
// students with older IDs report being refused.
export const STUDENT_ID_MAX_AGE_YEARS = 8;

export type ParsedStudentId = {
  /** First 7 digits. One account per key. */
  key: string;
  /** Last 3 digits: verification digit + program code. */
  suffix: string;
  /** First 2 digits as a number (YY, e.g. 22). */
  admissionYear: number;
};

/** Removes spaces and dashes, so "221 2345 042" and "221-2345-042" compare equal. */
export function normalizeStudentId(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Returns null when the ID is not valid: wrong format, unknown program, or an admission year in the future or too long ago. */
export function parseStudentId(raw: string, now: number = Date.now()): ParsedStudentId | null {
  const id = normalizeStudentId(raw);
  const match = STUDENT_ID_PATTERN.exec(id);
  if (!match || !Object.hasOwn(NSU_PROGRAM_CODES, match[3])) return null;
  const admissionYear = Number(match[1]);
  const currentYear = dhakaYear(now) % 100;
  if (admissionYear > currentYear || admissionYear < currentYear - STUDENT_ID_MAX_AGE_YEARS) {
    return null;
  }
  return { key: id.slice(0, 7), suffix: id.slice(7), admissionYear };
}

export function isValidStudentId(raw: string, now: number = Date.now()): boolean {
  return parseStudentId(raw, now) !== null;
}
