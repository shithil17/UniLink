import { STUDENT_ID_MAX_AGE_YEARS } from "../shared/studentId.ts";

// Every limit, cap, cooldown, expiry and threshold lives here. Feature code imports these, never inlines numbers.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const D1_MAX_BOUND_PARAMS = 100;

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
  d1MaxBoundParams: D1_MAX_BOUND_PARAMS,
  // ceiling: a notification insert binds 6 columns (id, user, type, payload, read_at, created_at), so a D1 statement holds 16 rows at the 100-parameter cap. Revisit if the platform raises the cap.
  notifyChunkRows: Math.floor(D1_MAX_BOUND_PARAMS / 6),
  // ceiling: a phone screen shows about this many rows; more arrive through the cursor. Revisit if the inbox feels short.
  inboxPage: { defaultSize: 20, maxSize: 50 },
  // ceiling: the largest NSU course map has well under 100 rows. Revisit if a map with many more slots arrives.
  courseImportMaxRows: 300,
  // ceiling: bounds D1 rows per user; a degree has around a dozen elective slots. Revisit if students report hitting it.
  studentCoursesMax: 40,
  // ceiling: a whole transcript entered in one sitting is roughly 50 attempts. Revisit if students hit it.
  attemptWrites: { limit: 200, windowMs: HOUR },
  // ceiling: a student has a phone, a laptop and a spare browser or two. Past this, subscribing is a 409 until a device is switched off. Revisit if students report hitting it.
  pushSubscriptionsMax: 5,
  /** Subscribe calls per user. Switching a device on is one call; this stops a loop from churning rows. */
  pushSubscribe: { limit: 30, windowMs: HOUR },
  // ceiling: a push is only worth showing soon after it happens; the inbox keeps the rest. Revisit if push services drop messages sooner.
  pushTtlSeconds: DAY / SECOND,
  // ceiling: one Worker request may make about 50 outbound requests on the free plan. A notify() call pushes to at most this many devices; every target still gets its inbox row. Revisit on a paid plan or when a fan-out moves to a queue.
  pushFanoutMax: 40,
} as const;
