import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { PrereqRule } from "../../shared/prereq";

// Key/value facts about the database itself (schema version and similar).
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Times are UTC epoch ms. Booleans are 0/1 integers.

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Public handle. Stored lowercase by the auth routes so the unique index is case-insensitive in practice.
    username: text("username").notNull().unique(),
    // First 7 digits of the student ID: one account per student. Private, never in a response.
    studentKey: text("student_key").notNull().unique(),
    // Last 3 digits of the student ID: verification digit (0 or 6) + program code. Private.
    studentSuffix: text("student_suffix").notNull(),
    // First 2 digits of the student ID (YY, e.g. 22). Selects the curriculum version.
    admissionYear: integer("admission_year").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    // Stored with the hash so the algorithm or iteration count can change later.
    passwordAlgo: text("password_algo").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    role: text("role", { enum: ["student", "mod", "admin"] })
      .notNull()
      .default("student"),
    bannedAt: integer("banned_at"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    // Full name as typed at signup. Private: never in a response other than the user's own.
    // Nullable because the seeded admin has none.
    fullName: text("full_name"),
    // NSU student email (lowercase). Private contact detail, never in a feed. Not verified yet:
    // `email_verified_at` stays null until verification is added. Unique: one account per email.
    email: text("email").unique(),
    emailVerifiedAt: integer("email_verified_at"),
    // Probing cooldown: no posting or editing until this instant (UTC epoch ms). Null when none was set.
    postingBlockedUntil: integer("posting_blocked_until"),
    // Set when the probing cooldown last triggered, and kept until a mod clears it. The mod panel shows it.
    probingFlaggedAt: integer("probing_flagged_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [check("users_role_check", sql`${t.role} in ('student', 'mod', 'admin')`)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 (hex) of the cookie token. The token itself is never stored.
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // A user id as a decimal string, or "automod" / "system".
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    // JSON snapshot of the target before the action, used to reverse it. Never holds a password or hash.
    before: text("before"),
    reason: text("reason"),
    // Set on a reversal row: the audit row it undoes. Unique, so a row is reversed at most once.
    reversesId: integer("reverses_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    // "What happened to this target" and "what did this actor do", newest first.
    index("audit_log_target_idx").on(t.targetType, t.targetId, t.id),
    index("audit_log_actor_idx").on(t.actor, t.id),
    uniqueIndex("audit_log_reverses_idx")
      .on(t.reversesId)
      .where(sql`${t.reversesId} is not null`),
  ],
);

// Reports on any kind of target. `targetType` is checked against the shared enum in code, not in the
// database, so a new post type needs no migration. `targetId` is text so any key shape fits.
export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["open", "resolved", "dismissed"] })
      .notNull()
      .default("open"),
    createdAt: integer("created_at").notNull(),
    resolvedBy: integer("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: integer("resolved_at"),
    resolveNote: text("resolve_note"),
  },
  (t) => [
    check("reports_status_check", sql`${t.status} in ('open', 'resolved', 'dismissed')`),
    // One open report per reporter per target. A resolved one does not block a new report.
    uniqueIndex("reports_open_unique_idx")
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`${t.status} = 'open'`),
    // The queue pages by id within one status.
    index("reports_status_id_idx").on(t.status, t.id),
    index("reports_target_idx").on(t.targetType, t.targetId),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    // Start of the fixed window, UTC epoch ms.
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export type ElectiveRule = { category: string; minFromOneTrail: number };

// An NSU course map for one program and version. A student's curriculum is picked by program code
// and admission year (see the course map route).
export const curricula = sqliteTable(
  "curricula",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Last two digits of the student ID, a key of NSU_PROGRAM_CODES.
    programCode: text("program_code").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    // Admission year (YY) the version applies from.
    effectiveFromYear: integer("effective_from_year").notNull(),
    // Degree total; earned credits may exceed it.
    totalCredits: real("total_credits").notNull(),
    // The elective category the trails fill and how many courses from one trail the curriculum asks
    // for. Null when the file has no trails. Shown on the map, never enforced.
    electiveRule: text("elective_rule", { mode: "json" }).$type<ElectiveRule | null>(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("curricula_program_version_idx").on(t.programCode, t.version)],
);

export type CourseAlternative = { code: string; title: string };

// One slot of a curriculum: a fixed course (with optional alternatives) or an elective placeholder.
export const courses = sqliteTable(
  "courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    curriculumId: integer("curriculum_id")
      .notNull()
      .references(() => curricula.id, { onDelete: "cascade" }),
    // Order in the import file; slots are filled in this order.
    position: integer("position").notNull(),
    kind: text("kind", { enum: ["course", "elective"] }).notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    // Real: some courses carry 1.5 credits.
    credits: real("credits").notNull(),
    category: text("category").notNull(),
    nonCredit: integer("non_credit", { mode: "boolean" }).notNull().default(false),
    semester: integer("semester"),
    // JSON array of { code, title }; empty for electives.
    alternatives: text("alternatives", { mode: "json" }).$type<CourseAlternative[]>().notNull(),
    // JSON prerequisite rule tree (src/shared/prereq.ts); null means none.
    prereq: text("prereq", { mode: "json" }).$type<PrereqRule | null>(),
    // Set by a moderator in place of deleting. A hidden slot leaves the student course map unless the student already has an attempt on one of its codes.
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("courses_curriculum_code_idx").on(t.curriculumId, t.code),
    index("courses_curriculum_idx").on(t.curriculumId),
    // The open elective lookup finds a course by its exact code in any curriculum.
    index("courses_code_idx").on(t.code),
  ],
);

// A course a curriculum lists under one of its elective trails (a CSE student picks from these).
// Replaced together with the curriculum's courses on every import and seed.
export const electiveOptions = sqliteTable(
  "elective_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    curriculumId: integer("curriculum_id")
      .notNull()
      .references(() => curricula.id, { onDelete: "cascade" }),
    trail: text("trail").notNull(),
    // Order in the import file across all trails; trails and their courses show in this order.
    position: integer("position").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    credits: real("credits").notNull(),
  },
  (t) => [
    uniqueIndex("elective_options_curriculum_code_idx").on(t.curriculumId, t.code),
    index("elective_options_code_idx").on(t.code),
  ],
);

// NSU faculty of every department, for the attempt picker. The seeded list comes from data/faculty/; mods
// add, edit and hide rows. Public, read-only for students.
export const faculty = sqliteTable(
  "faculty",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    // NSU's university-wide faculty code (like "RkZ"). Many departments do not publish one.
    initials: text("initials"),
    designation: text("designation").notNull(),
    // A code from src/shared/departments.ts. The default only exists because SQLite's ADD COLUMN needs one
    // for a NOT NULL column; every insert names its department.
    department: text("department").notNull().default("ECE"),
    // The profile page on northsouth.edu, when there is one.
    nsuPage: text("nsu_page"),
    // A hidden row never reaches the student picker; attempts that already point at it keep working.
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    // The seed upserts on this pair, so running it again updates a row instead of duplicating it.
    uniqueIndex("faculty_name_department_idx").on(t.name, t.department),
    // Initials are unique across the university, compared without case. Rows without initials are exempt.
    uniqueIndex("faculty_initials_idx")
      .on(sql`lower(${t.initials})`)
      .where(sql`${t.initials} is not null`),
    index("faculty_department_idx").on(t.department),
    // The directory pages by (name, id); this index serves that order and its keyset cursor without a sort.
    index("faculty_name_idx").on(t.name, t.id),
  ],
);

// Graded attempts are the only source of truth for done courses. Owner only: never read for another user.
export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A curriculum slot code, an alternative code, or one of the user's student course codes.
    courseCode: text("course_code").notNull(),
    grade: text("grade").notNull(),
    termYear: integer("term_year"),
    termSeason: text("term_season", { enum: ["spring", "summer", "fall"] }),
    // The faculty who taught it. Optional; a removed faculty row leaves the attempt without one.
    facultyId: integer("faculty_id").references(() => faculty.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attempts_user_idx").on(t.userId)],
);

// A course a student adds themselves (an elective they took). Private to the owner.
export const studentCourses = sqliteTable(
  "student_courses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    credits: real("credits").notNull(),
    // One of the student's curriculum categories.
    category: text("category").notNull(),
    // Kept on the map but counted toward no total, prerequisite or CGPA.
    excluded: integer("excluded", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("student_courses_user_code_idx").on(t.userId, t.code)],
);

// A class a student attends in a term. Owner only: never read for another user, mods and admins
// included, and never used in a notification.
export const routineEntries = sqliteTable(
  "routine_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    termYear: integer("term_year").notNull(),
    termSeason: text("term_season", { enum: ["spring", "summer", "fall"] }).notNull(),
    // A curriculum slot code, an alternative code, or one of the user's student course codes.
    courseCode: text("course_code").notNull(),
    section: integer("section").notNull(),
    // NSU day letters in week order, for example "MW". See src/shared/routine.ts.
    days: text("days").notNull(),
    // Minutes after midnight, Asia/Dhaka local time.
    startMinutes: integer("start_minutes").notNull(),
    endMinutes: integer("end_minutes").notNull(),
    room: text("room").notNull().default(""),
    // Faculty initials as printed on the routine; free text, not a link to the faculty table.
    facultyInitials: text("faculty_initials").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("routine_entries_user_term_idx").on(t.userId, t.termYear, t.termSeason),
    check("routine_entries_times_check", sql`${t.endMinutes} > ${t.startMinutes}`),
  ],
);

// In-app notifications, one row per recipient. Owner only: every read and write is scoped to the user.
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A value of `notificationType` (src/shared/schemas/inbox.ts).
    type: text("type").notNull(),
    // Never names another user.
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    // Unread count and mark-all-read.
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    // The newest-first feed pages by id within one user.
    index("notifications_user_id_idx").on(t.userId, t.id),
  ],
);

// Web Push subscriptions, one row per browser/device. The endpoint is unique: signing in on a shared
// device moves the row to the new user. `p256dh` and `auth` are the device's encryption keys. Private.
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);
