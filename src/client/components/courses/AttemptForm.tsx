import { zodResolver } from "@hookform/resolvers/zod";
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
}: {
  choices: readonly { code: string; title: string }[];
  onSaved: () => void;
  onCancel?: () => void;
  mode?: "quick" | "full";
  attempt?: Attempt;
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
      record.mutate(values, done);
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
                      className="text-[11px] leading-none font-medium text-faint tabular-nums group-data-checked/radio-chip:text-brand-ink"
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
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending
              ? "Saving..."
              : attempt
                ? "Save changes"
                : mode === "full"
                  ? "Save attempt"
                  : "Save grade"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}
