import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api";
import { formatCredits } from "@/lib/courseMap";
import { useAddStudentCourse, useCourseLookup, useUpdateStudentCourse } from "@/lib/courses";
import {
  studentCourseInput,
  type StudentCourse,
  type StudentCourseInput,
} from "../../../shared/schemas/courses";
import { OptionSelect } from "./OptionSelect";

type FormValues = z.input<typeof studentCourseInput>;

// ceiling: wait for a pause in typing before looking a code up; a code is 6 or 7 characters, so
// this keeps it to about one request per code. Revisit if lookups feel slow on a poor connection.
const LOOKUP_DELAY_MS = 350;

const hintOutsideTrail =
  "Any course from any discipline. A course like one you already took won't count.";

/**
 * Add a student course, or edit one (the code is then read-only). Server errors stay inline:
 * code_taken on the code, unknown_category on the category, anything else above the button.
 */
export function StudentCourseForm({
  categories,
  trailCategory,
  initial,
  existing,
  onSaved,
  onCancel,
}: {
  categories: readonly string[];
  /** The category the curriculum's elective trails fill, if it has any. */
  trailCategory?: string;
  /** Starting values for a new course (the category is preset). */
  initial: { category: string };
  /** The course being edited, if any. */
  existing?: StudentCourse;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const add = useAddStudentCourse();
  const update = useUpdateStudentCourse(existing?.id ?? 0);
  const mutation = existing ? update : add;
  const form = useForm<FormValues, unknown, StudentCourseInput>({
    resolver: zodResolver(studentCourseInput),
    defaultValues: existing
      ? {
          code: existing.code,
          title: existing.title,
          credits: existing.credits,
          category: existing.category,
          excluded: existing.excluded,
        }
      : { code: "", title: "", category: initial.category, excluded: false },
  });
  const { errors } = form.formState;
  const category = useWatch({ control: form.control, name: "category" });
  const typedCode = useWatch({ control: form.control, name: "code" });

  // Look the typed code up once typing pauses, and fill title and credits that are still empty.
  const [lookupCode, setLookupCode] = useState("");
  useEffect(() => {
    if (existing) return;
    const timer = setTimeout(() => setLookupCode(typedCode ?? ""), LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typedCode, existing]);
  const lookup = useCourseLookup(existing ? "" : lookupCode);
  const found = lookup.data ?? null;
  // What we filled in ourselves, so a different code can replace it but typed text is never touched.
  const filled = useRef<{ title?: string; credits?: number }>({});
  useEffect(() => {
    if (!found) return;
    const { title, credits } = form.getValues();
    if (!title?.trim() || title === filled.current.title) {
      form.setValue("title", found.title, { shouldValidate: form.formState.isSubmitted });
      filled.current.title = found.title;
    }
    if (
      credits === undefined ||
      Number.isNaN(credits) ||
      String(credits) === "" ||
      credits === filled.current.credits
    ) {
      form.setValue("credits", found.credits, { shouldValidate: form.formState.isSubmitted });
      filled.current.credits = found.credits;
    }
  }, [found, form]);
  const foundNow =
    found && found.code === typedCode?.trim().toUpperCase() && !existing ? found : null;

  const submit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success("Course saved");
        onSaved();
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "code_taken") form.setError("code", { message: errorMessage(err) });
        else if (code === "unknown_category") {
          form.setError("category", { message: errorMessage(err) });
        } else toast.error(errorMessage(err));
      },
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.code)}>
          <FieldLabel htmlFor="sc-code">Course code</FieldLabel>
          <Input
            id="sc-code"
            className="h-11 uppercase"
            placeholder="CSE115"
            autoCapitalize="characters"
            autoComplete="off"
            readOnly={Boolean(existing)}
            aria-invalid={Boolean(errors.code)}
            {...form.register("code")}
          />
          {existing ? (
            <FieldDescription>The code cannot change once the course is added.</FieldDescription>
          ) : foundNow ? (
            <FieldDescription>
              Found: {foundNow.title}, {formatCredits(foundNow.credits)} cr
            </FieldDescription>
          ) : null}
          <FieldError errors={[errors.code]} />
        </Field>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="sc-title">Title</FieldLabel>
          <Input
            id="sc-title"
            className="h-11"
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
            {...form.register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={Boolean(errors.credits)}>
          <FieldLabel htmlFor="sc-credits">Credits</FieldLabel>
          <Input
            id="sc-credits"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            className="h-11"
            aria-invalid={Boolean(errors.credits)}
            {...form.register("credits", { valueAsNumber: true })}
          />
          <FieldError errors={[errors.credits]} />
        </Field>
        <Field data-invalid={Boolean(errors.category)}>
          <FieldLabel htmlFor="sc-category">Category</FieldLabel>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <OptionSelect
                id="sc-category"
                value={field.value}
                onChange={field.onChange}
                options={categories.map((c) => ({ value: c, label: c }))}
                invalid={Boolean(errors.category)}
              />
            )}
          />
          {category !== trailCategory ? (
            <FieldDescription>{hintOutsideTrail}</FieldDescription>
          ) : null}
          <FieldError errors={[errors.category]} />
        </Field>
        <Controller
          control={form.control}
          name="excluded"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="sc-excluded"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
              <div className="space-y-1">
                <FieldLabel htmlFor="sc-excluded">Exclude from transcript</FieldLabel>
                <FieldDescription>
                  It stays on your map but doesn't count toward any total.
                </FieldDescription>
              </div>
            </Field>
          )}
        />
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" className="sm:flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : existing ? "Save changes" : "Add course"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
