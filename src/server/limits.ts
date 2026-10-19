import { STUDENT_ID_MAX_AGE_YEARS } from "../shared/studentId.ts";

// Every limit, cap, cooldown, expiry and threshold lives here. Feature code imports these, never inlines numbers.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const limits = {
  /** Oldest admission year accepted at signup, in years before the current one. Defined in shared code for the client form. */
  studentIdMaxAgeYears: STUDENT_ID_MAX_AGE_YEARS,
  /** Signups per client IP. Suggested defaults until the team decides. */
  signupPerIp: { limit: 5, windowMs: HOUR },
  /** Login attempts per username. */
  loginPerUsername: { limit: 10, windowMs: 15 * MINUTE },
  /** A new account cannot post or submit links until this long after `created_at`. */
  newAccountCooldownMs: DAY,
  /** How long a session cookie stays valid. */
  sessionTtlMs: 30 * DAY,
  /** Random bytes in a session token. */
  sessionTokenBytes: 32,
  /** Random bytes in a password salt. */
  passwordSaltBytes: 16,
  // ceiling: Workers throws on PBKDF2 above 100,000 iterations. Revisit if the platform raises the cap.
  pbkdf2Iterations: 100_000,
  // ceiling: D1 allows 100 bound parameters per statement, so bulk inserts are chunked to fit. Revisit if the platform raises it.
  d1MaxBoundParams: 100,
  // ceiling: the largest NSU course map has well under 100 rows. Revisit if a map with many more slots arrives.
  courseImportMaxRows: 300,
  // ceiling: bounds D1 rows per user; a degree has around a dozen elective slots. Revisit if students report hitting it.
  studentCoursesMax: 40,
  // ceiling: a whole transcript entered in one sitting is roughly 50 attempts. Revisit if students hit it.
  attemptWrites: { limit: 200, windowMs: HOUR },
} as const;
