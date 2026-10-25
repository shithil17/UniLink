import { describe, expect, it } from "vite-plus/test";
import { changePasswordForm, signupForm, signupRequest } from "./auth";

const signup = {
  username: "rahim_1",
  fullName: "Rahim Uddin",
  email: "rahim.uddin@northsouth.edu",
  studentId: "2211234042",
  password: "correct horse",
};

describe("signupForm", () => {
  it("accepts a matching repeat, which the request schema then strips", () => {
    const values = signupForm.parse({ ...signup, confirmPassword: "correct horse" });
    expect(signupRequest.parse(values)).not.toHaveProperty("confirmPassword");
  });

  it("puts a mismatch on the repeat field", () => {
    const result = signupForm.safeParse({ ...signup, confirmPassword: "correct horsf" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["confirmPassword"]]);
  });
});

describe("changePasswordForm", () => {
  it("compares the repeat with the new password, not the current one", () => {
    const base = { currentPassword: "old password", newPassword: "new password" };
    expect(changePasswordForm.safeParse({ ...base, confirmPassword: "new password" }).success).toBe(
      true,
    );
    expect(changePasswordForm.safeParse({ ...base, confirmPassword: "old password" }).success).toBe(
      false,
    );
  });
});
