import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
