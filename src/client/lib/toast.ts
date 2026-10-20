import { toast as sonner, type ExternalToast } from "sonner";

/**
 * How long an error toast stays up. Errors have no inline fallback, so they get twice sonner's
 * 4 s default to be read. Success toasts keep the default.
 */
export const ERROR_TOAST_MS = 8000;

/** Sonner's `toast`, with error toasts held longer. Import this instead of `sonner`. */
export const toast = Object.assign(
  (...args: Parameters<typeof sonner>) => sonner(...args),
  sonner,
  {
    error: (message: Parameters<typeof sonner.error>[0], data?: ExternalToast) =>
      sonner.error(message, { duration: ERROR_TOAST_MS, ...data }),
  },
);
