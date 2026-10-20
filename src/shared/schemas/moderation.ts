import { z } from "zod";
import { role } from "./auth.ts";
import { id, instant, page, pageQuery, reasonCategory, reportTargetType } from "./common.ts";

export const verdict = z.enum(["approve", "review", "reject"]);

export const screenResult = z.object({ verdict, category: reasonCategory });

/** The deterministic rules that can flag a post. The queue shows these next to the model's category. */
export const ruleName = z.enum([
  "student_id",
  "card_number",
  "url",
  "contact_format",
  "length",
  "banned_word",
  "image",
]);

/** What a model step returns. Validated before use: model output is never trusted as it comes. */
export const modelStepResult = screenResult.extend({
  /** 0 to 1: how sure the model is of its verdict. */
  confidence: z.number().min(0).max(1).nullable(),
  /** Per-category scores, kept in the audit row only. Never shown to the author. */
  scores: z.record(z.string(), z.number()),
});

// These lengths are shared with the client forms, so they live here rather than in `limits.ts`.
export const REASON_MIN_LENGTH = 3;
// ceiling: a mod reason is one or two sentences in the audit log. Revisit if mods ask for longer notes.
export const REASON_MAX_LENGTH = 300;
// ceiling: a two-letter prefix keeps the username range scan from reading most of the table. Revisit if mods can't find short usernames.
export const USER_SEARCH_MIN_LENGTH = 2;
// Usernames are at most 20 characters, so a longer prefix can never match.
export const USER_SEARCH_MAX_LENGTH = 20;
// ceiling: audit target types and ids are short keys ("user", a numeric id); this bounds the filter text. Revisit if a target type name or key ever exceeds it.
export const AUDIT_FILTER_MAX_LENGTH = 40;

/** Why someone reported, or why a mod or admin acted. The latter is stored in the audit log with the action. */
export const reasonText = z
  .string()
  .trim()
  .min(REASON_MIN_LENGTH, `Give a reason of at least ${REASON_MIN_LENGTH} characters`)
  .max(REASON_MAX_LENGTH, `Use at most ${REASON_MAX_LENGTH} characters`);

export const reasonBody = z.object({ reason: reasonText });

// ---- Reports (any signed-in user) -----------------------------------------------------------

export const reportRequest = z.object({
  targetType: reportTargetType,
  targetId: id,
  reason: reasonText,
});

export const reportCreated = z.object({ id });

// ---- Users (mods and admins) ----------------------------------------------------------------

/** A user as mods see them: the public handle, role and state. Never the student ID, email or name. */
export const modUser = z.object({
  id,
  username: z.string(),
  role,
  bannedAt: instant.nullable(),
  mustChangePassword: z.boolean(),
  createdAt: instant,
  /** Set when the probing cooldown triggered; stays until a mod clears it. */
  probingFlaggedAt: instant.nullable(),
  /** No posting until this instant. Past or null means no cooldown is active. */
  postingBlockedUntil: instant.nullable(),
});

/** A username prefix to search for. */
export const usernameSearch = z
  .string()
  .trim()
  .toLowerCase()
  .min(USER_SEARCH_MIN_LENGTH, `Type at least ${USER_SEARCH_MIN_LENGTH} characters`)
  .max(USER_SEARCH_MAX_LENGTH)
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores only");

export const modUsersQuery = pageQuery.extend({ q: usernameSearch.optional() });

/** The search box: empty means no search (the newest users). */
export const userSearchForm = z.object({ q: z.union([usernameSearch, z.literal("")]) });

export const modUserPage = page(modUser);

export const temporaryPassword = z.object({ temporaryPassword: z.string() });

export const roleChangeRequest = z.object({
  /** Promote a student to `mod`, or demote a mod back to `student`. Admins are not managed here. */
  role: z.enum(["mod", "student"]),
  reason: reasonText,
});

// ---- ID-conflict tool (the only response that carries a student ID) --------------------------

export const STUDENT_KEY_LENGTH = 7;

export const idConflictQuery = z.object({
  key: z
    .string()
    .trim()
    .regex(/^\d{7}$/, `Enter the ${STUDENT_KEY_LENGTH}-digit student ID key`),
});

export const idConflictHolder = modUser.extend({
  /** The full student ID (7-digit key plus 3-digit suffix). Private: shown only here. */
  studentId: z.string(),
});

export const idConflictResult = z.object({ holder: idConflictHolder.nullable() });

export const releaseKeyRequest = z.object({ userId: id, reason: reasonText });

// ---- Report queue (mods and admins) ---------------------------------------------------------

export const reportStatus = z.enum(["open", "resolved", "dismissed"]);

export const modReport = z.object({
  id,
  targetType: reportTargetType,
  targetId: z.string(),
  /** A public label for the target (a username for a user), or null when it no longer exists. */
  targetLabel: z.string().nullable(),
  reporter: z.string().nullable(),
  reason: z.string(),
  status: reportStatus,
  createdAt: instant,
  resolvedAt: instant.nullable(),
  resolveNote: z.string().nullable(),
});

export const modReportsQuery = pageQuery.extend({ status: reportStatus.default("open") });

export const modReportPage = page(modReport);

export const resolveReportRequest = z.object({
  outcome: z.enum(["resolved", "dismissed"]),
  note: reasonText.optional(),
});

// ---- Mod queue: held posts and open reports in one list (mods and admins) -------------------

/** A held post as mods see it. The author is a username; contact details are never part of it. */
export const modQueuePost = z.object({
  kind: z.literal("post"),
  /** The post type (a key of the moderated post registry) and the post's id in its table. */
  targetType: z.string(),
  id,
  /** The screened text, one entry per field. */
  text: z.array(z.string()),
  author: z.string().nullable(),
  /** The category of the latest automatic decision. "fine" with a hold means the model or a forced flag held it. */
  category: reasonCategory,
  confidence: z.number().min(0).max(1).nullable(),
  /** The rule names that fired. */
  flags: z.array(ruleName),
  model: z.string().nullable(),
  /** True when the author tapped "Ask a moderator to look" on a rejection. */
  appealed: z.boolean(),
});

export const modQueueReport = modReport.extend({ kind: z.literal("report") });

export const modQueueItem = z.discriminatedUnion("kind", [modQueuePost, modQueueReport]);

export const modQueuePage = page(modQueueItem).extend({
  /** The whole queue (held posts plus open reports), not just this page. */
  total: z.number().int().nonnegative(),
});

/** Categories a mod can reject with. "fine" is a verdict, not a reason. */
export const rejectCategory = reasonCategory.exclude(["fine"], "Choose a reason category");

export const approvePostRequest = z.object({ reason: reasonText.optional() });

export const rejectPostRequest = z.object({
  reason: reasonText,
  /** Shown to the author as a category-level message. */
  category: rejectCategory,
});

// ---- Audit log (admins) ---------------------------------------------------------------------

export const auditEntry = z.object({
  id,
  /** A username, "automod" or "system". */
  actor: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  /** A username for a user target, else null. */
  targetLabel: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: instant,
  /** The id of the entry this one reverses, if it is a reversal. */
  reverses: id.nullable(),
  /** The id of the reversal, once an admin has reversed this entry. */
  reversedBy: id.nullable(),
  /** True when an admin can reverse it now. */
  reversible: z.boolean(),
});

export const auditQuery = pageQuery.extend({
  actor: z.string().trim().min(1).max(USER_SEARCH_MAX_LENGTH).optional(),
  targetType: z.string().trim().min(1).max(AUDIT_FILTER_MAX_LENGTH).optional(),
  targetId: z.string().trim().min(1).max(AUDIT_FILTER_MAX_LENGTH).optional(),
});

export const auditPage = page(auditEntry);

export const reverseResult = z.object({ id });

export type ModUser = z.infer<typeof modUser>;
export type ModReport = z.infer<typeof modReport>;
export type ModQueueItem = z.infer<typeof modQueueItem>;
export type ModQueuePost = z.infer<typeof modQueuePost>;
export type AuditEntry = z.infer<typeof auditEntry>;
export type IdConflictHolder = z.infer<typeof idConflictHolder>;
