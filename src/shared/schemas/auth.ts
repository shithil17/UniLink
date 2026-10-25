import { z } from "zod";
import { isValidStudentId } from "../studentId.ts";

// These two lengths are shared with the client forms, so they live here rather than in the
// server-only `limits.ts`. Change them here and both sides follow.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
// ceiling: caps the bytes PBKDF2 has to chew on per request. Revisit if people need longer passphrases.
export const PASSWORD_MAX_LENGTH = 128;

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 80;
/** Student emails are on this domain. Subdomains and look-alikes are refused. */
export const NSU_EMAIL_DOMAIN = "northsouth.edu";

export const role = z.enum(["student", "mod", "admin"]);

/** Trimmed and lowercased, so "Alice_1 " and "alice_1" are the same username. */
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores only");

/** Trimmed, with runs of spaces collapsed, so "  Rahim   Uddin " is stored as "Rahim Uddin". */
export const fullName = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(FULL_NAME_MIN_LENGTH, "Enter your full name")
      .max(FULL_NAME_MAX_LENGTH, `Use at most ${FULL_NAME_MAX_LENGTH} characters`),
  );

/** An NSU student email, trimmed and lowercased. Only the domain is checked: the local part varies. */
export const nsuEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Enter a valid email address")
      .refine(
        (value) => value.endsWith(`@${NSU_EMAIL_DOMAIN}`),
        `Use your @${NSU_EMAIL_DOMAIN} email`,
      ),
  );

export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const signupRequest = z.object({
  username,
  fullName,
  email: nsuEmail,
  studentId: z.string().refine((value) => isValidStudentId(value), "Enter a valid NSU student ID"),
  password: newPassword,
});

/** Login does not re-check the strength rules: an old password must still be accepted. */
export const loginRequest = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});

export const changePasswordRequest = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(PASSWORD_MAX_LENGTH),
  newPassword,
});

/**
 * The client forms ask for the new password twice. The repeat is checked here and stripped before
 * the request goes out, so the API never sees it.
 */
const confirmPassword = z.string().min(1, "Enter the password again");
const PASSWORDS_DIFFER = "The passwords don't match";

export const signupForm = signupRequest
  .extend({ confirmPassword })
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORDS_DIFFER,
    path: ["confirmPassword"],
  });

export const changePasswordForm = changePasswordRequest
  .extend({ confirmPassword })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORDS_DIFFER,
    path: ["confirmPassword"],
  });

/** The signed-in user as seen by themselves. Never includes the student ID. */
export const me = z.object({
  username: z.string(),
  role,
  admissionYear: z.number().int(),
  mustChangePassword: z.boolean(),
});

export type SignupRequest = z.infer<typeof signupRequest>;
export type LoginRequest = z.infer<typeof loginRequest>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequest>;
export type SignupForm = z.infer<typeof signupForm>;
export type ChangePasswordForm = z.infer<typeof changePasswordForm>;
export type Me = z.infer<typeof me>;
