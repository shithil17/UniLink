import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { toastFieldErrors, toastFirstFieldError } from "./formErrors";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => vi.mocked(toast.error).mockClear());

describe("toastFirstFieldError", () => {
  it("toasts the first message in field order", () => {
    toastFirstFieldError({
      username: { type: "required", message: "Enter your username." },
      password: { type: "required", message: "Enter your password." },
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Enter your username.");
  });

  it("finds messages in nested objects, arrays and root, ignoring the DOM ref", () => {
    toastFirstFieldError({
      title: undefined,
      rows: [undefined, { code: { type: "x", message: "Row 2 needs a code.", ref: {} } }],
    } as never);
    expect(toast.error).toHaveBeenCalledWith("Row 2 needs a code.");

    vi.mocked(toast.error).mockClear();
    toastFirstFieldError({ root: { type: "server", message: "Something is off." } } as never);
    expect(toast.error).toHaveBeenCalledWith("Something is off.");
  });

  it("replaces zod's default wording with the field name", () => {
    toastFirstFieldError({
      courseCode: {
        type: "too_small",
        message: "Too small: expected string to have >=1 characters",
      },
    } as never);
    expect(toast.error).toHaveBeenCalledWith("Check the course code field.");
  });

  it("stays quiet when there is no message", () => {
    toastFirstFieldError({});
    toastFirstFieldError({ name: { type: "x" } } as never);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("toastFieldErrors", () => {
  it("swaps the message of named fields and leaves the others", () => {
    const toastWith = toastFieldErrors({
      term: "Pick the term you took it in.",
      start: (m) => (m?.startsWith("Use a time") ? "Pick a start time" : m),
    });
    toastWith({ term: { type: "invalid_type", message: "Invalid input" } } as never);
    expect(toast.error).toHaveBeenLastCalledWith("Pick the term you took it in.");

    toastWith({ start: { type: "x", message: "Use a time like 09:30" } } as never);
    expect(toast.error).toHaveBeenLastCalledWith("Pick a start time");

    toastWith({ start: { type: "x", message: "End must be after start" } } as never);
    expect(toast.error).toHaveBeenLastCalledWith("End must be after start");

    toastWith({ grade: { type: "x", message: "Pick a grade." } } as never);
    expect(toast.error).toHaveBeenLastCalledWith("Pick a grade.");
  });
});
