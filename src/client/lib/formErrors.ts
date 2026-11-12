import type { FieldErrors, FieldValues } from "react-hook-form";
import { toast } from "@/lib/toast";

/** Keys on an RHF error node that are not nested field errors. */
const SKIP = new Set(["ref", "types", "type"]);

/** Zod's built-in wording, which reads as a bug report in a toast ("Too small: expected string..."). */
const ZOD_DEFAULT =
  /^(Too small|Too big|Invalid input|Invalid option|Invalid string|Invalid number)/;

type Found = { path: string[]; message: string };

function firstError(node: unknown, path: string[]): Found | undefined {
  if (!node || typeof node !== "object") return undefined;
  const { message } = node as { message?: unknown };
  if (typeof message === "string" && message) return { path, message };
  const entries: [string, unknown][] = Array.isArray(node)
    ? node.map((child, index) => [String(index), child])
    : Object.entries(node).filter(([key]) => !SKIP.has(key));
  for (const [key, child] of entries) {
    const found = firstError(child, [...path, key]);
    if (found) return found;
  }
  return undefined;
}

/** `courseCode` -> "course code": the field's name when the schema's own wording is unusable. */
function fieldLabel(path: string[]) {
  const name = [...path].reverse().find((part) => !/^\d+$/.test(part) && part !== "root");
  return (name ?? "form").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

/**
 * The second argument of `form.handleSubmit(onValid, toastFirstFieldError)`. Per-field messages are
 * screen-reader only, so a failed submit toasts the first message in field order (nested, array and
 * `root` errors included). React Hook Form's own `shouldFocusError` then focuses that field.
 * Zod's default wording is swapped for "Check the <field> field." so the toast stays readable.
 */
export function toastFirstFieldError<T extends FieldValues = FieldValues>(
  errors: FieldErrors<T>,
): void {
  const found = firstError(errors, []);
  if (!found) return;
  toast.error(
    ZOD_DEFAULT.test(found.message) ? `Check the ${fieldLabel(found.path)} field.` : found.message,
  );
}

/**
 * A message for a field, or a function that maps the schema's message to the one to show. Used by
 * forms whose `FieldError` text differs from the schema's (a friendlier blank-field line).
 */
export type FieldMessage = string | ((schemaMessage: string | undefined) => string | undefined);

/**
 * Like `toastFirstFieldError`, but swaps the message of the named top-level fields first, so the
 * toast says what the field's own `FieldError` says. Fields that pass no error are left alone.
 */
export function toastFieldErrors(messages: Record<string, FieldMessage>) {
  return <T extends FieldValues = FieldValues>(errors: FieldErrors<T>): void => {
    const rewritten: Record<string, unknown> = {};
    for (const [name, error] of Object.entries(errors)) {
      const rewrite = messages[name];
      if (!error || rewrite === undefined) {
        rewritten[name] = error;
        continue;
      }
      const schemaMessage = (error as { message?: string }).message;
      const message = typeof rewrite === "function" ? rewrite(schemaMessage) : rewrite;
      rewritten[name] = { ...error, message };
    }
    toastFirstFieldError(rewritten as FieldErrors<T>);
  };
}
