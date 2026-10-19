import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { termLabel, termOptions, termValue } from "@/lib/courseMap";
import { isToastError, useRecordAttempt } from "@/lib/courses";
import { useState } from "react";
import { LETTER_GRADES } from "../../../shared/grading";
import { attemptInput, type AttemptInput } from "../../../shared/schemas/attempts";
import { OptionSelect } from "./OptionSelect";

const NO_TERM = "none";
const gradeOptions = LETTER_GRADES.map((g) => ({ value: g, label: g }));

/** The quick attempt form: which course, the letter grade, and when (optional). */
export function AttemptForm({
  choices,
  onSaved,
}: {
  choices: readonly { code: string; title: string }[];
  onSaved: () => void;
}) {
  const record = useRecordAttempt();
  const [serverError, setServerError] = useState<string | null>(null);
  const terms = termOptions();
  const termChoices = [
    { value: NO_TERM, label: "Not sure" },
    ...terms.map((t) => ({ value: termValue(t), label: termLabel(t) })),
  ];
  const form = useForm<AttemptInput>({
    resolver: zodResolver(attemptInput),
    defaultValues: { courseCode: choices[0]?.code ?? "", term: null },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    record.mutate(values, {
      onSuccess: () => {
        toast.success("Saved");
        onSaved();
      },
      onError: (err) => {
        if (isToastError(err)) toast.error(errorMessage(err));
        else setServerError(errorMessage(err));
      },
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {choices.length > 1 ? (
          <Field data-invalid={Boolean(errors.courseCode)}>
            <FieldLabel htmlFor="attempt-course">Course</FieldLabel>
            <Controller
              control={form.control}
              name="courseCode"
              render={({ field }) => (
                <OptionSelect
                  id="attempt-course"
                  value={field.value}
                  onChange={field.onChange}
                  options={choices.map((c) => ({ value: c.code, label: `${c.code} ${c.title}` }))}
                  invalid={Boolean(errors.courseCode)}
                />
              )}
            />
            <FieldError errors={[errors.courseCode]} />
          </Field>
        ) : null}
        <Field data-invalid={Boolean(errors.grade)}>
          <FieldLabel htmlFor="attempt-grade">Grade</FieldLabel>
          <Controller
            control={form.control}
            name="grade"
            render={({ field }) => (
              <OptionSelect
                id="attempt-grade"
                value={field.value ?? null}
                onChange={field.onChange}
                options={gradeOptions}
                placeholder="Pick a grade"
                invalid={Boolean(errors.grade)}
              />
            )}
          />
          <FieldError errors={[errors.grade]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="attempt-term">Term (optional)</FieldLabel>
          <Controller
            control={form.control}
            name="term"
            render={({ field }) => (
              <OptionSelect
                id="attempt-term"
                value={field.value ? termValue(field.value) : NO_TERM}
                onChange={(v) => field.onChange(terms.find((t) => termValue(t) === v) ?? null)}
                options={termChoices}
              />
            )}
          />
        </Field>
        <FormError message={serverError} />
        <Button type="submit" className="h-11 w-full" disabled={record.isPending}>
          {record.isPending ? "Saving..." : "Save grade"}
        </Button>
      </FieldGroup>
    </form>
  );
}
