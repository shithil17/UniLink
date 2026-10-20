import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { reasonBody } from "../../../shared/schemas/moderation";
import { ReasonField } from "./ReasonField";

type Values = z.infer<typeof reasonBody>;

/** A reason box with one confirm button, for actions that are a single choice (release, reverse). */
export function ReasonForm({
  id,
  submitLabel,
  pendingLabel,
  variant = "default",
  pending,
  serverError,
  hint,
  onSubmit,
  onCancel,
}: {
  id: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: "default" | "destructive" | "outline";
  pending: boolean;
  serverError: string | null;
  hint?: string;
  onSubmit: (reason: string) => void;
  onCancel?: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(reasonBody),
    defaultValues: { reason: "" },
  });
  const submit = form.handleSubmit((values) => onSubmit(values.reason));

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <ReasonField
          id={id}
          register={form.register("reason")}
          error={form.formState.errors.reason}
          hint={hint}
        />
        <FormError message={serverError} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" variant={variant} size="lg" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
