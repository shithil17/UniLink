import {
  AUDIT_FILTER_MAX_LENGTH,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  USER_SEARCH_MAX_LENGTH,
  USER_SEARCH_MIN_LENGTH,
} from "../shared/schemas/moderation.ts";
import { TARGET_CGPA_MAX, TARGET_CGPA_MIN } from "../shared/schemas/attempts.ts";
import {
  FACULTY_DESIGNATION_MAX_LENGTH,
  FACULTY_INITIALS_MAX_LENGTH,
  FACULTY_INITIALS_MIN_LENGTH,
  FACULTY_NAME_MAX_LENGTH,
  FACULTY_PAGE_MAX_LENGTH,
  FACULTY_SEARCH_MAX_LENGTH,
} from "../shared/schemas/faculty.ts";
import {
  ROUTINE_INITIALS_MAX_LENGTH,
  ROUTINE_ROOM_MAX_LENGTH,
  ROUTINE_SECTION_MAX,
} from "../shared/schemas/routine.ts";
import {
  PLANNER_FALLBACK_CEILING,
  PLANNER_FALLBACK_AVERAGE,
  PLANNER_HISTORY_MIN_COURSES,
  PLANNER_MAX_SUGGESTIONS,
  PLANNER_MIN_RETAKE_EFFECT,
  PLANNER_PRIOR_COURSES,
  PLANNER_ROWS_SHOWN,
} from "../shared/planner.ts";
import {
  RESOURCE_EXPIRY_MAX_MS,
  RESOURCE_FULFILLED_KEEP_MS,
  RESOURCE_EXPIRY_MIN_MS,
  RESOURCE_NOTE_MAX_LENGTH,
} from "../shared/schemas/resources.ts";
import { STUDENT_ID_MAX_AGE_YEARS } from "../shared/studentId.ts";
import { RESOURCE_URL_MAX_LENGTH } from "../shared/resourceUrl.ts";

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
  // ceiling: the faculty directory grows toward a thousand people across every department, so the picker and the mod panel load it a page at a time and search on the server. A phone shows about this many rows; more arrive through the cursor. Revisit if the picker feels short.
  facultyPage: { defaultSize: 20, maxSize: 50 },
  // ceiling: a faculty search is a name or initials, a few words at most. The length is defined in shared code for the client box; the word cap bounds the SQL (each word is a bound parameter and a LIKE). Revisit if a real search is cut short.
  facultySearch: { maxLength: FACULTY_SEARCH_MAX_LENGTH, maxWords: 6 },
  // ceiling: mod-entered faculty fields only need to hold real NSU names, designations, initials and profile links. Defined in shared code for the client form. Revisit if a real value is refused.
  facultyField: {
    nameMax: FACULTY_NAME_MAX_LENGTH,
    designationMax: FACULTY_DESIGNATION_MAX_LENGTH,
    initialsMin: FACULTY_INITIALS_MIN_LENGTH,
    initialsMax: FACULTY_INITIALS_MAX_LENGTH,
    pageMax: FACULTY_PAGE_MAX_LENGTH,
  },
  // ceiling: a whole transcript entered in one sitting is roughly 50 attempts. Revisit if students hit it.
  attemptWrites: { limit: 200, windowMs: HOUR },
  // ceiling: a student sets a target once and nudges it a few times while planning; this stops a loop from churning the row. Revisit if students report hitting it.
  targetWrites: { limit: 30, windowMs: HOUR },
  // ceiling: the planner runs in the browser. With fewer graded courses than this (about two terms) the student's own history says too little about their ceiling, so the fallback ceiling is assumed and predictions are called rough. Defined in shared code. Revisit once real transcripts show a better cut-off.
  plannerHistoryMinCourses: PLANNER_HISTORY_MIN_COURSES,
  // ceiling: the best grade assumed while history is thin; it only bounds the best case. Defined in shared code. Revisit if advice for new students proves too hopeful.
  plannerFallbackCeiling: PLANNER_FALLBACK_CEILING,
  // ceiling: the average a student with no history is predicted at; predictions move from it toward the student's own grades. Defined in shared code. Revisit once real transcripts show the usual first-year average.
  plannerFallbackAverage: PLANNER_FALLBACK_AVERAGE,
  // ceiling: how many courses' worth of weight that starting point keeps in each prediction; larger trusts a student's own category grades less. Defined in shared code. Revisit once predictions can be checked against real results.
  plannerPriorCourses: PLANNER_PRIOR_COURSES,
  // ceiling: each retake costs a student extra tuition, so advice names a handful at most. Defined in shared code. Revisit if students need longer plans.
  plannerMaxSuggestions: PLANNER_MAX_SUGGESTIONS,
  // ceiling: the smallest CGPA change worth listing under "retakes that help most"; below it a retake doesn't move the CGPA at two decimals. Defined in shared code. Revisit if students want the full list.
  plannerMinRetakeEffect: PLANNER_MIN_RETAKE_EFFECT,
  // ceiling: rows a planner list shows before "Show all": a term or two of courses, about two phone screens. Defined in shared code for the client list. Revisit if students keep opening the full list.
  plannerRowsShown: PLANNER_ROWS_SHOWN,
  // ceiling: the NSU scale tops out at 4.00, so a target above it can never be met and one at or below 0 means nothing. Defined in shared code for the client form. Revisit if NSU changes its scale.
  targetCgpa: { min: TARGET_CGPA_MIN, max: TARGET_CGPA_MAX },
  // ceiling: bounds D1 rows per user and term; a term is five or six courses, each a lecture and sometimes a lab. Revisit if students report hitting it.
  routineEntriesMax: 40,
  // ceiling: a term is entered in one sitting, a few dozen writes; this stops a loop from churning rows. Revisit if students report hitting it.
  routineWrites: { limit: 100, windowMs: HOUR },
  // ceiling: NSU sections are numbered in the low tens; room and initials are short codes printed on the routine. Defined in shared code for the client form. Revisit if a real value is refused.
  routineField: {
    sectionMax: ROUTINE_SECTION_MAX,
    roomMax: ROUTINE_ROOM_MAX_LENGTH,
    initialsMax: ROUTINE_INITIALS_MAX_LENGTH,
  },
  // ceiling: a student has a phone, a laptop and a spare browser or two. Past this, subscribing is a 409 until a device is switched off. Revisit if students report hitting it.
  pushSubscriptionsMax: 5,
  /** Subscribe calls per user. Switching a device on is one call; this stops a loop from churning rows. */
  pushSubscribe: { limit: 30, windowMs: HOUR },
  // ceiling: a push is only worth showing soon after it happens; the inbox keeps the rest. Revisit if push services drop messages sooner.
  pushTtlSeconds: DAY / SECOND,
  // ceiling: one Worker request may make about 50 outbound requests on the free plan. A notify() call pushes to at most this many devices; every target still gets its inbox row. Revisit on a paid plan or when a fan-out moves to a queue.
  pushFanoutMax: 40,
  /** Test pushes an admin may send to their own devices. Enough to check a few phones, not a spam loop. */
  pushTest: { limit: 10, windowMs: HOUR },
  // ceiling: a student reports a handful of things a day; this stops a loop from flooding the queue. Revisit if mods say honest reporters are blocked.
  reportCreate: { limit: 10, windowMs: HOUR },
  // ceiling: a phone screen shows about this many rows; more arrive through the cursor. Revisit if mods find the lists short.
  modPage: { defaultSize: 20, maxSize: 50 },
  // ceiling: a reason is one or two sentences in the audit log and the report queue. Defined in shared code for the client forms. Revisit if mods ask for longer notes.
  modReasonLength: { min: REASON_MIN_LENGTH, max: REASON_MAX_LENGTH },
  // ceiling: a two-letter minimum keeps the username prefix scan small; usernames are at most 20 characters. Defined in shared code for the client forms. Revisit if mods can't find short usernames.
  userSearchLength: { min: USER_SEARCH_MIN_LENGTH, max: USER_SEARCH_MAX_LENGTH },
  // ceiling: audit target types and ids are short keys; this bounds the filter text. Defined in shared code. Revisit if a key outgrows it.
  auditFilterMaxLength: AUDIT_FILTER_MAX_LENGTH,
  // ceiling: 12 characters from a 32-letter alphabet is about 60 bits, plenty for a password that must be replaced at the next login. Revisit if the alphabet or the login rules change.
  tempPasswordLength: 12,
  // ceiling: a request or link note is a sentence or two; a link is a host and an id. Defined in shared code for the client forms. Revisit if honest notes or links are refused.
  resourceField: { noteMax: RESOURCE_NOTE_MAX_LENGTH, urlMax: RESOURCE_URL_MAX_LENGTH },
  // ceiling: a request stays open from an hour to two months: long enough to span a term's material, short enough that stale asks do not pile up. Defined in shared code for the client form. Revisit if students want longer.
  resourceExpiry: { minMs: RESOURCE_EXPIRY_MIN_MS, maxMs: RESOURCE_EXPIRY_MAX_MS },
  // ceiling: an honest student asks for a few things a day; this stops a loop from notifying the whole cohort. Revisit if students report hitting it.
  resourceRequestCreate: { limit: 5, windowMs: DAY },
  // ceiling: one student keeps a handful of asks going at once. Past this, a new request is a 409 until one is fulfilled or lapses. Revisit if students report hitting it.
  resourceOpenRequestsMax: 10,
  // ceiling: sending a link is quick, so this is generous but stops a loop. Revisit if helpers report hitting it.
  resourceSubmit: { limit: 20, windowMs: HOUR },
  // ceiling: accepting and turning down links is a few taps per request. Revisit if students report hitting it.
  resourceDecide: { limit: 60, windowMs: HOUR },
  // ceiling: one helper sends a request a couple of links at most (a retry after a refused one). Revisit if students report hitting it.
  resourceSubmissionsPerUser: 3,
  // ceiling: a requester reads the links one by one; more than this is a pile, not help. Past it, new links are a 409. Revisit if requests routinely fill up.
  resourceSubmissionsPerRequest: 25,
  // ceiling: a notify() call writes one D1 batch (16 rows per statement), so a very large cohort stays inside one request's subrequest budget. Students past the cap are not told; the request is still open to any link. Revisit on a paid plan or when a fan-out moves to a queue.
  resourceFanoutMax: 1000,
  // ceiling: a phone screen shows about this many rows; more arrive through the cursor. Revisit if the list feels short.
  resourcePage: { defaultSize: 20, maxSize: 50 },
  // ceiling: a phone list of requests the student can help with; past this the soonest-expiring same-faculty ones show and the rest are not listed. Revisit if students report missing requests.
  resourceHelpableMax: 50,
  // ceiling: three months: long enough to find the link again after the exam, short enough to keep shared links from piling up. The UI states it. Defined in shared code so the screens can state it. Revisit if students ask for longer.
  resourceFulfilledKeepMs: RESOURCE_FULFILLED_KEEP_MS,
  /** The screening pipeline: what the rules accept and how long the model step may take. */
  screen: {
    // ceiling: the longest screened field (a description or note) is a few paragraphs; a wall of text is spam. Per-post-type schemas set tighter caps. Revisit if honest posts are rejected for length.
    textMaxLength: 2000,
    // ceiling: matches the 3-photo cap on lost-and-found and marketplace posts. Revisit with that cap.
    imagesMax: 3,
    // ceiling: the browser re-encodes to WebP at quality 0.8 with a 1600px longest side, which lands well under this. The Worker never converts images. Revisit if honest photos are rejected.
    imageMaxBytes: 512 * 1024,
    // ceiling: the browser resizes the longest side to this before encoding. Revisit with the client encoder.
    imageMaxSidePx: 1600,
    // ceiling: a post waits on this call, so a slow model must not hold the request open. A timeout means pending_review. Revisit once Clef latency is measured.
    modelTimeoutMs: 8 * SECOND,
    // ceiling: keeps a day of model calls inside the free Workers AI allowance (the window is the UTC day, which is when Cloudflare resets it). Over this, posts wait for a moderator. Revisit with real traffic.
    modelDailyCap: 2000,
    modelCapWindowMs: DAY,
    // ceiling: the audit row keeps enough text for a mod to see what was judged, not a whole essay. Revisit if mods need more.
    snapshotMaxLength: 1000,
    // ceiling: a student ID typed in groups ("22 1 2345 0 42") spans at most this many digit groups, and a card at most five. Bounds the scan so a long run of numbers stays cheap. Revisit if people split IDs further.
    digitGroupsMax: 6,
  },
  /** "Ask a moderator to look": an author sends a rejected post to the queue. */
  // ceiling: an honest author appeals the odd post; this stops a loop from flooding the queue. Revisit if mods say honest authors are blocked.
  appeal: { limit: 5, windowMs: HOUR },
  /** Probing: someone resubmitting a post until the screen lets it through. */
  probing: {
    // ceiling: three rejections in an hour is more than an honest mistake or two. Revisit if mods see honest students flagged.
    rejections: 3,
    windowMs: HOUR,
    // ceiling: long enough to stop a retry loop, short enough not to punish a real mistake. Revisit if probing continues after the cooldown.
    cooldownMs: HOUR,
  },
} as const;
