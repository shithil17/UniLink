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
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { MAP_BOUNDS } from "../../shared/geo";
import type { PrereqRule } from "../../shared/prereq";
import { RIDE_SEATS_MAX, vehicleType } from "../../shared/schemas/rides";
import { contactColumns, contactConstraint } from "./contactColumns";
import { moderationColumns, moderationConstraints } from "./moderationColumns";

type Vehicle = (typeof vehicleType.options)[number];

/**
 * A map point held in two nullable columns: both set or both null, and a set point inside the
 * greater-Dhaka box. The numbers come from `MAP_BOUNDS`, so the check and the schemas agree.
 */
const pointCheck = (name: string, lat: AnySQLiteColumn, lng: AnySQLiteColumn) =>
  check(
    name,
    sql`(${lat} is null) = (${lng} is null) and (${lat} is null or (${lat} between ${sql.raw(String(MAP_BOUNDS.south))} and ${sql.raw(String(MAP_BOUNDS.north))} and ${lng} between ${sql.raw(String(MAP_BOUNDS.west))} and ${sql.raw(String(MAP_BOUNDS.east))}))`,
  );

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
    // The mod's reason for the ban, shown to the user when they try to log in. Null when not banned.
    banReason: text("ban_reason"),
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
    // Grade planner target CGPA in hundredths (350 = 3.50). Private and owner-only: no mod or admin read selects it.
    targetCgpa: integer("target_cgpa"),
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
  (t) => [
    index("attempts_user_idx").on(t.userId),
    // The resource fan-out finds who took a course, a faculty member's class, or both. The user id is last
    // so each lookup is answered from the index alone. Faculty-only requests use the second one.
    index("attempts_course_faculty_idx").on(t.courseCode, t.facultyId, t.userId),
    index("attempts_faculty_course_idx").on(t.facultyId, t.courseCode, t.userId),
  ],
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

// A student asks for study material by course, faculty member, or both. Matching students are
// notified; others answer with links. Open requests are hard-deleted by cron once they lapse, and a
// fulfilled one some months after it was fulfilled (src/server/cron.ts). Never carries contact details.
export const resourceRequests = sqliteTable(
  "resource_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // The requester. Deleting the user deletes their requests.
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A course code as typed by the student, upper-cased. Matches `attempts.course_code` exactly.
    courseCode: text("course_code"),
    facultyId: integer("faculty_id").references(() => faculty.id, { onDelete: "cascade" }),
    note: text("note"),
    ...moderationColumns,
    // The requester's chosen lapse time. After it the request is expired, whatever its status.
    expiresAt: integer("expires_at").notNull(),
    // Set once, when the requester accepts a link. Null while the request is open or lapsed.
    fulfilledAt: integer("fulfilled_at"),
    // The link the requester accepted. A plain id, not a foreign key: the table pair would reference each other.
    acceptedSubmissionId: integer("accepted_submission_id"),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    ...moderationConstraints("resource_requests", t),
    check(
      "resource_requests_target_check",
      sql`${t.courseCode} is not null or ${t.facultyId} is not null`,
    ),
    // "My requests", newest first.
    index("resource_requests_author_idx").on(t.authorId, t.id),
    // The cron purges: open ones past their expiry, fulfilled ones past their keep period.
    index("resource_requests_expires_idx").on(t.expiresAt),
    index("resource_requests_fulfilled_idx").on(t.fulfilledAt),
    // "Help others": open requests for a course the student took, any faculty.
    index("resource_requests_course_idx").on(t.courseCode, t.expiresAt),
    // "Help others": open faculty-only requests for a faculty member the student had.
    index("resource_requests_faculty_idx").on(t.facultyId, t.expiresAt),
  ],
);

// A link someone sent for a request. Only the requester sees `url`. Deleted with its request.
export const resourceSubmissions = sqliteTable(
  "resource_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id")
      .notNull()
      .references(() => resourceRequests.id, { onDelete: "cascade" }),
    // The uploader. Named `author_id` like every post table.
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A safe https URL by the rule in src/shared/resourceUrl.ts.
    url: text("url").notNull(),
    note: text("note"),
    ...moderationColumns,
    // Set when the requester turns the link down. Acceptance lives on the request.
    rejectedAt: integer("rejected_at"),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    ...moderationConstraints("resource_submissions", t),
    // The requester's list of links, and the per-request caps.
    index("resource_submissions_request_idx").on(t.requestId, t.id),
    index("resource_submissions_author_idx").on(t.authorId, t.requestId),
  ],
);

// Places students pick from (rides now; lost and found may reuse them). A top-level area has no parent;
// a sub-area has a top-level parent, one level only (the mod action checks it). Mods hide an area in place
// of deleting it, so rows that point at it keep working. `sort_order` is a pin: lower sorts first
// (Bashundhara 0, the rest 1, "Outside Dhaka" 2), then by name.
export const areas = sqliteTable(
  "areas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Stable, kebab-case, set when the area is added and never changed by a rename.
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").references((): AnySQLiteColumn => areas.id),
    sortOrder: integer("sort_order").notNull().default(1),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    hiddenReason: text("hidden_reason"),
    // The area's centre (WGS84, 5 decimals), or null when it has none ("Outside Dhaka"). Centres the pin
    // picker and stands in on a ride map for an end with no exact pin.
    lat: real("lat"),
    lng: real("lng"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    pointCheck("areas_point_check", t.lat, t.lng),
    uniqueIndex("areas_slug_idx").on(t.slug),
    // A name is unique among siblings, ignoring case: one index for the top level, one under each parent
    // (NULLs never collide in a unique index, so the top level needs its own).
    uniqueIndex("areas_top_name_idx")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.parentId} is null`),
    uniqueIndex("areas_sub_name_idx")
      .on(t.parentId, sql`lower(${t.name})`)
      .where(sql`${t.parentId} is not null`),
    index("areas_parent_idx").on(t.parentId),
  ],
);

// A ride a student offers: one-off (a departure instant) or recurring (weekdays, a time of day and an
// end date). Contacts are only ever returned by `GET /api/rides/:id/contact`. A lapsed ride is
// hard-deleted by cron (src/server/cron.ts). Whether it is full is not stored: it is `seats_remaining
// = 0`, so it can never disagree with the seat count.
export const rides = sqliteTable(
  "rides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // The poster. Deleting the user deletes their rides.
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Where from and to, by area. The landmark is the fine detail ("north gate"), screened text.
    pickupAreaId: integer("pickup_area_id")
      .notNull()
      .references(() => areas.id),
    pickupLandmark: text("pickup_landmark"),
    // The exact spot the poster pinned (WGS84, 5 decimals), optional. Only the ride detail returns it.
    pickupLat: real("pickup_lat"),
    pickupLng: real("pickup_lng"),
    destinationAreaId: integer("destination_area_id")
      .notNull()
      .references(() => areas.id),
    destinationLandmark: text("destination_landmark"),
    destinationLat: real("destination_lat"),
    destinationLng: real("destination_lng"),
    vehicle: text("vehicle", {
      enum: vehicleType.options as [Vehicle, ...Vehicle[]],
    }).notNull(),
    totalSeats: integer("total_seats").notNull(),
    // Changed only by single guarded UPDATEs, never read-then-write.
    seatsRemaining: integer("seats_remaining").notNull(),
    pricePerSeatTaka: integer("price_per_seat_taka").notNull(),
    notes: text("notes"),
    ...contactColumns,
    kind: text("kind", { enum: ["one_off", "recurring"] }).notNull(),
    // One-off: the departure, UTC epoch ms.
    departsAt: integer("departs_at"),
    // Recurring: bit i is Asia/Dhaka weekday i (Sunday is bit 0), see src/shared/rides.ts.
    days: integer("days"),
    // Recurring: minutes after midnight in Asia/Dhaka.
    departureMinutes: integer("departure_minutes"),
    // Recurring: the last Asia/Dhaka day it runs, "YYYY-MM-DD". `expires_at` is the end of that day.
    endsOn: text("ends_on"),
    ...moderationColumns,
    // One-off: the departure. Recurring: the end of `ends_on` in Asia/Dhaka. The feed hides a row past it.
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    ...moderationConstraints("rides", t),
    contactConstraint("rides", t),
    check(
      "rides_vehicle_check",
      sql`${t.vehicle} in (${sql.raw(vehicleType.options.map((v) => `'${v}'`).join(", "))})`,
    ),
    check(
      "rides_seats_check",
      sql`${t.totalSeats} between 1 and ${sql.raw(String(RIDE_SEATS_MAX))} and ${t.seatsRemaining} between 0 and ${t.totalSeats}`,
    ),
    check("rides_price_check", sql`${t.pricePerSeatTaka} >= 0`),
    pointCheck("rides_pickup_point_check", t.pickupLat, t.pickupLng),
    pointCheck("rides_destination_point_check", t.destinationLat, t.destinationLng),
    // Each kind has exactly its own fields.
    check(
      "rides_kind_check",
      sql`(${t.kind} = 'one_off' and ${t.departsAt} is not null and ${t.days} is null and ${t.departureMinutes} is null and ${t.endsOn} is null)
        or (${t.kind} = 'recurring' and ${t.departsAt} is null and ${t.days} is not null and ${t.days} between 1 and 127 and ${t.departureMinutes} is not null and ${t.departureMinutes} between 0 and 1439 and ${t.endsOn} is not null and ${t.endsOn} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
    // "My rides", newest first.
    index("rides_author_idx").on(t.authorId, t.id),
    // The feed: soonest to lapse first (a one-off's departure), paged by (expires_at, id), and the cron purge.
    index("rides_expires_idx").on(t.expiresAt, t.id),
    // The feed filtered by vehicle, and by kind with a departure day.
    index("rides_vehicle_expires_idx").on(t.vehicle, t.expiresAt),
    index("rides_kind_departs_idx").on(t.kind, t.departsAt),
    // The Map view's counts: published rides still live, with no ordering to steer the planner to `rides_expires_idx`, so without this it would walk every published ride, lapsed ones too.
    index("rides_status_expires_idx").on(t.status, t.expiresAt),
    // The feed filtered by area.
    index("rides_pickup_area_expires_idx").on(t.pickupAreaId, t.expiresAt),
    index("rides_destination_area_expires_idx").on(t.destinationAreaId, t.expiresAt),
    // The cron purge of author-deleted rides: only deleted rows are indexed, so it never scans the table.
    index("rides_deleted_idx")
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} is not null`),
  ],
);
