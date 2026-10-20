import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api";
import { isToastError, useAddStudentCourse, useUpdateStudentCourse } from "@/lib/courses";
import {
  studentCourseInput,
  type StudentCourse,
  type StudentCourseInput,
} from "../../../shared/schemas/courses";
import { OptionSelect } from "./OptionSelect";

type FormValues = z.input<typeof studentCourseInput>;

/**
 * Add a student course, or edit one (the code is then read-only). Server errors stay inline:
 * code_taken on the code, unknown_category on the category, anything else above the button.
 */
export function StudentCourseForm({
  categories,
  initial,
  existing,
  onSaved,
  onCancel,
}: {
  categories: readonly string[];
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
  const [serverError, setServerError] = useState<string | null>(null);
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

  const submit = form.handleSubmit((values) => {
    setServerError(null);
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
        } else if (isToastError(err)) toast.error(errorMessage(err));
        else setServerError(errorMessage(err));
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
        <FormError message={serverError} />
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
