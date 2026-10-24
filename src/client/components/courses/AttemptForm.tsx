import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { RadioChip, RadioGroup } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { termLabel, termOptions, termValue } from "@/lib/courseMap";
import { useRecordAttempt, useUpdateAttempt } from "@/lib/courses";
import { ATTEMPT_GRADES, gradeLabel, gradePoints, WAIVED } from "../../../shared/grading";
import {
  attemptFullInput,
  attemptInput,
  type Attempt,
  type AttemptInput,
} from "../../../shared/schemas/attempts";
import { FacultyPicker } from "./FacultyPicker";
import { OptionSelect } from "./OptionSelect";

const NO_TERM = "none";

// ceiling: the sheet takes 320ms to slide out (200ms fade under reduced motion), so the "Grade
// saved" toast waits a beat longer: close first, then confirm. Revisit if the sheet's timing changes.
const CONFIRM_AFTER_CLOSE_MS = 340;
const CONFIRM_AFTER_CLOSE_REDUCED_MS = 200;

function confirmAfterClose(message: string) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  window.setTimeout(
    () => toast.success(message),
    reduced ? CONFIRM_AFTER_CLOSE_REDUCED_MS : CONFIRM_AFTER_CLOSE_MS,
  );
}

/** One tile per grade: the grade over its points, from the shared scale. I, W and WV have none. */
const gradeTiles = ATTEMPT_GRADES.map((g) => {
  const points = gradePoints(g);
  return {
    value: g,
    points: points === null ? "-" : points.toFixed(1),
    // The name starts with the visible text so voice control and screen readers agree.
    label:
      g === WAIVED
        ? `${g}, ${gradeLabel(g).toLowerCase()}`
        : points === null
          ? `${g}, no grade points`
          : `${g}, ${points.toFixed(1)} points`,
  };
});

/**
 * One attempt form in three shapes:
 * - `quick` (the map's tick): course and grade, term optional, no faculty;
 * - `full`: a new attempt that must say its term, with the faculty picker;
 * - editing (`attempt` given): the grade, term and faculty of a recorded attempt.
 */
export function AttemptForm({
  choices,
  onSaved,
  onCancel,
  mode = "quick",
  attempt,
  locked = false,
  confirmAfterSheetCloses = false,
}: {
  choices: readonly { code: string; title: string }[];
  onSaved: () => void;
  onCancel?: () => void;
  mode?: "quick" | "full";
  attempt?: Attempt;
  /** The course's prerequisites are not met: the grades, the term and the button are disabled. */
  locked?: boolean;
  /** `onSaved` closes the sheet, so the "Grade saved" toast waits until it has gone. */
  confirmAfterSheetCloses?: boolean;
}) {
  const record = useRecordAttempt();
  const update = useUpdateAttempt(attempt?.id ?? 0);
  const pending = attempt ? update.isPending : record.isPending;
  const termRequired = mode === "full" && !attempt;
  const showFaculty = mode === "full" || Boolean(attempt);
  const terms = termOptions();
  const known = (t: Attempt["term"]) =>
    t === null || terms.some((o) => termValue(o) === termValue(t));
  const allTerms =
    attempt && !known(attempt.term) && attempt.term ? [...terms, attempt.term] : terms;
  const termChoices = [
    ...(termRequired ? [] : [{ value: NO_TERM, label: "Not sure" }]),
    ...allTerms.map((t) => ({ value: termValue(t), label: termLabel(t) })),
  ];
  const form = useForm<AttemptInput>({
    resolver: zodResolver(termRequired ? attemptFullInput : attemptInput) as Resolver<AttemptInput>,
    defaultValues: attempt
      ? {
          courseCode: attempt.courseCode,
          grade: attempt.grade,
          term: attempt.term,
          facultyId: attempt.facultyId,
        }
      : { courseCode: choices[0]?.code ?? "", term: null, facultyId: null },
  });
  const { errors } = form.formState;
  const grade = useWatch({ control: form.control, name: "grade" });

  const submit = form.handleSubmit((values) => {
    const done = {
      onSuccess: () => {
        if (!attempt && confirmAfterSheetCloses) {
          onSaved();
          confirmAfterClose("Grade saved");
          return;
        }
        toast.success(attempt ? "Attempt updated" : "Grade saved");
        onSaved();
      },
      onError: (err: unknown) => toast.error(errorMessage(err)),
    };
    if (attempt) {
      update.mutate(
        { grade: values.grade, term: values.term ?? null, facultyId: values.facultyId ?? null },
        done,
      );
    } else {
      // The faculty picker is hidden in the quick form, so a faculty picked in the full form (and
      // kept in form state for the toggle back) is not sent from here.
      record.mutate(mode === "quick" ? { ...values, facultyId: null } : values, done);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {choices.length > 1 && !attempt ? (
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
          <FieldLabel id="attempt-grade-label">Grade</FieldLabel>
          <Controller
            control={form.control}
            name="grade"
            render={({ field }) => (
              <RadioGroup
                id="attempt-grade"
                aria-labelledby="attempt-grade-label"
                aria-invalid={Boolean(errors.grade)}
                disabled={locked}
                value={field.value ?? null}
                onValueChange={(v) => field.onChange(v)}
                onBlur={field.onBlur}
                className="grid-cols-6 gap-1.5"
              >
                {gradeTiles.map((g) => (
                  <RadioChip key={g.value} value={g.value} aria-label={g.label}>
                    <span aria-hidden className="text-[15px] leading-none font-bold">
                      {g.value}
                    </span>
                    <span
                      aria-hidden
                      className="text-[12px] leading-none font-medium text-faint tabular-nums group-data-checked/radio-chip:text-brand-ink"
                    >
                      {g.points}
                    </span>
                  </RadioChip>
                ))}
              </RadioGroup>
            )}
          />
          {grade === WAIVED ? (
            <FieldDescription>
              A waived course counts toward your credits, not your CGPA.
            </FieldDescription>
          ) : null}
          <FieldError errors={[errors.grade]} />
        </Field>
        <Field data-invalid={Boolean(errors.term)}>
          <FieldLabel htmlFor="attempt-term">
            {termRequired ? "Term" : "Term (optional)"}
          </FieldLabel>
          <Controller
            control={form.control}
            name="term"
            render={({ field }) => (
              <OptionSelect
                id="attempt-term"
                value={field.value ? termValue(field.value) : termRequired ? null : NO_TERM}
                onChange={(v) => field.onChange(allTerms.find((t) => termValue(t) === v) ?? null)}
                options={termChoices}
                placeholder="Pick a term"
                invalid={Boolean(errors.term)}
                disabled={locked}
              />
            )}
          />
          <FieldError errors={[errors.term && { message: "Pick the term you took it in." }]} />
        </Field>
        {showFaculty ? (
          <Field>
            <FieldLabel htmlFor="attempt-faculty">Faculty (optional)</FieldLabel>
            <Controller
              control={form.control}
              name="facultyId"
              render={({ field }) => (
                <FacultyPicker
                  id="attempt-faculty"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  current={attempt?.faculty}
                />
              )}
            />
          </Field>
        ) : null}
        {locked ? (
          <p className="flex items-start gap-2 text-sm leading-snug font-medium text-danger">
            <LockIcon aria-hidden className="mt-px size-[18px] shrink-0" />
            You haven't met the prerequisites yet.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={pending || locked}>
            {pending
              ? "Saving..."
              : attempt
                ? "Save changes"
                : mode === "full"
                  ? "Save attempt"
                  : "Record a grade"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}
