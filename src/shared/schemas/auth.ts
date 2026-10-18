import { z } from "zod";
import { isValidStudentId } from "../studentId.ts";

// These two lengths are shared with the client forms, so they live here rather than in the
// server-only `limits.ts`. Change them here and both sides follow.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
// ceiling: caps the bytes PBKDF2 has to chew on per request. Revisit if people need longer passphrases.
export const PASSWORD_MAX_LENGTH = 128;

export const role = z.enum(["student", "mod", "admin"]);

/** Trimmed and lowercased, so "Alice_1 " and "alice_1" are the same username. */
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores only");

export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const signupRequest = z.object({
  username,
  studentId: z.string().refine(isValidStudentId, "Enter a valid NSU student ID"),
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
export type Me = z.infer<typeof me>;
