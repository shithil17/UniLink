import { z } from "zod";
import { isValidStudentId } from "../studentId";

export const role = z.enum(["student", "mod", "admin"]);

export const signupRequest = z.object({
  username: z.string(),
  studentId: z.string().refine(isValidStudentId, "Enter a valid NSU student ID"),
  password: z.string(),
});

export const loginRequest = z.object({ username: z.string(), password: z.string() });

export const changePasswordRequest = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

/** The signed-in user as seen by themselves. Never includes the student ID. */
export const me = z.object({
  username: z.string(),
  role,
  admissionYear: z.number().int(),
  mustChangePassword: z.boolean(),
});
