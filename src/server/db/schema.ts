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

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // A user id as a decimal string, or "automod" / "system".
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  // JSON snapshot of the target before the action, used to reverse it.
  before: text("before"),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});

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
  },
  (t) => [
    uniqueIndex("courses_curriculum_code_idx").on(t.curriculumId, t.code),
    index("courses_curriculum_idx").on(t.curriculumId),
  ],
);

// NSU CSE faculty, for the attempt picker. The seeded list comes from data/faculty.json. Public, read-only.
export const faculty = sqliteTable(
  "faculty",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    designation: text("designation").notNull(),
  },
  // The seed upserts on name, so running it again updates a row instead of duplicating it.
  (t) => [uniqueIndex("faculty_name_idx").on(t.name)],
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
