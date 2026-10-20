import type { FieldError as RhfFieldError, UseFormRegisterReturn } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { REASON_MAX_LENGTH } from "../../../shared/schemas/moderation";

/** The reason every mod action asks for. It is kept in the audit log next to the action. */
export function ReasonField({
  id,
  register,
  error,
  hint = "It goes in the audit log, so write what an admin would need to know.",
}: {
  id: string;
  register: UseFormRegisterReturn;
  error: RhfFieldError | undefined;
  hint?: string;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>Reason</FieldLabel>
      <Textarea
        id={id}
        rows={3}
        maxLength={REASON_MAX_LENGTH}
        aria-invalid={Boolean(error)}
        {...register}
      />
      <FieldDescription>{hint}</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  );
}
