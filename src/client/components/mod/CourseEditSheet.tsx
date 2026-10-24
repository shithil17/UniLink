import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api";
import {
  categoriesOf,
  changedFields,
  prereqCodesFor,
  useAddCourse,
  useEditCourse,
  useSetCourseHidden,
} from "@/lib/modCourses";
import { courseAddConfirm, courseEditConfirm, courseHiddenConfirm } from "@/lib/curriculumConfirm";
import { NOTHING_TO_SAVE } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { prereqCourseCodes } from "../../../shared/prereq";
import { formatPrereq } from "../../../shared/prereqText";
import { SEMESTER_MAX } from "../../../shared/schemas/courses";
import {
  courseInput,
  type CourseFormValues,
  type CourseInput,
  type ModCourse,
} from "../../../shared/schemas/modCourses";
import { useConfirm } from "@/lib/useConfirm";
import { ReasonForm } from "./ReasonForm";

/** What the sheet is showing: a new slot (`"new"`), an existing one, or nothing (closed). */
export type CourseSheetTarget = ModCourse | "new" | null;

const NEW_CATEGORY = "\u0000new";
const kindChoices = [
  { value: "course", label: "Course" },
  { value: "elective", label: "Elective placeholder" },
];

export function CourseEditSheet({
  target,
  curriculumId,
  courses,
  defaultCategory,
  onClose,
}: {
  target: CourseSheetTarget;
  curriculumId: number;
  /** Every slot of the curriculum, for the categories and the prerequisite check. */
  courses: readonly ModCourse[];
  defaultCategory: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {target ? (
          <CourseEditor
            key={target === "new" ? "new" : target.id}
            course={target === "new" ? null : target}
            curriculumId={curriculumId}
            courses={courses}
            defaultCategory={defaultCategory}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CourseEditor({
  course,
  curriculumId,
  courses,
  defaultCategory,
  onClose,
}: {
  course: ModCourse | null;
  curriculumId: number;
  courses: readonly ModCourse[];
  defaultCategory: string | null;
  onClose: () => void;
}) {
  const add = useAddCourse(curriculumId);
  const edit = useEditCourse(course?.id ?? 0);
  const setHidden = useSetCourseHidden(course?.id ?? 0);
  const categories = categoriesOf(courses);
  const [newCategory, setNewCategory] = useState(categories.length === 0);

  const form = useForm<CourseFormValues, unknown, CourseInput>({
    resolver: zodResolver(courseInput),
    defaultValues: {
      kind: course?.kind ?? "course",
      code: course?.code ?? "",
      title: course?.title ?? "",
      credits: course?.credits,
      category: course?.category ?? defaultCategory ?? "",
      nonCredit: course?.nonCredit ?? false,
      semester: course?.semester ?? null,
      alternatives: course?.alternatives ?? [],
      prereq: formatPrereq(course?.prereq),
    },
  });
  const alternatives = useFieldArray({ control: form.control, name: "alternatives" });
  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });
  const confirm = useConfirm();

  // A refusal that belongs to a field is marked on it too, where the mod can fix it once the confirm
  // sheet is closed. The error is thrown on, so the sheet shows it as well.
  const fail = (err: unknown): never => {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "code_taken" || code === "code_referenced") {
      form.setError("code", { message: errorMessage(err) });
    } else if (code === "prereq_unknown") {
      form.setError("prereq", { message: errorMessage(err) });
    }
    throw err;
  };

  const submit = form.handleSubmit((values) => {
    // A prerequisite on a code nobody can pass would lock the course for everyone, so it is refused here too.
    const known = prereqCodesFor(courses, course?.id ?? null);
    const unknown = [...new Set(prereqCourseCodes(values.prereq))].filter((c) => !known.has(c));
    if (unknown.length > 0) {
      form.setError("prereq", {
        message: `${unknown.join(", ")} ${unknown.length === 1 ? "isn't" : "aren't"} another course in this curriculum. Check the spelling, or add that course first.`,
      });
      return;
    }
    if (!course) {
      confirm.ask({
        ...courseAddConfirm(values),
        run: async () => {
          await add.mutateAsync(values).catch(fail);
          toast.success("Course added");
          onClose();
        },
      });
      return;
    }
    const patch = changedFields(course, values);
    if (Object.keys(patch).length === 0) {
      toast(NOTHING_TO_SAVE);
      return;
    }
    confirm.ask({
      ...courseEditConfirm(course, patch),
      run: async () => {
        await edit.mutateAsync(patch).catch(fail);
        toast.success("Course updated");
        onClose();
      },
    });
  });

  const altError = errors.alternatives?.message ?? errors.alternatives?.root?.message;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{course ? `Edit ${course.code}` : "Add a course"}</SheetTitle>
        <SheetDescription>
          {course
            ? "Changes show on students' course maps right away."
            : "It goes at the end of its category and shows for students right away."}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-5 pb-4">
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.kind)}>
              <FieldLabel htmlFor="course-kind">Kind</FieldLabel>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <OptionSelect
                    id="course-kind"
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      // An elective placeholder has no alternatives.
                      if (v === "elective") alternatives.replace([]);
                    }}
                    options={kindChoices}
                  />
                )}
              />
              <FieldDescription>
                {kind === "course"
                  ? "A course students record grades for."
                  : "An open slot (like ELECT1) that a student fills with a course of their own."}
              </FieldDescription>
            </Field>
            <Field data-invalid={Boolean(errors.code)}>
              <FieldLabel htmlFor="course-code">Code</FieldLabel>
              <Input
                id="course-code"
                className="uppercase"
                placeholder={kind === "course" ? "CSE115" : "ELECT1"}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.code)}
                {...form.register("code")}
              />
              {course ? (
                <FieldDescription>
                  Changing the code detaches grades students recorded under the old one.
                </FieldDescription>
              ) : null}
              <FieldError errors={[errors.code]} />
            </Field>
            <Field data-invalid={Boolean(errors.title)}>
              <FieldLabel htmlFor="course-title">Title</FieldLabel>
              <Input
                id="course-title"
                autoComplete="off"
                aria-invalid={Boolean(errors.title)}
                {...form.register("title")}
              />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={Boolean(errors.credits)}>
              <FieldLabel htmlFor="course-credits">Credits</FieldLabel>
              <Input
                id="course-credits"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                aria-invalid={Boolean(errors.credits)}
                {...form.register("credits", { valueAsNumber: true })}
              />
              <FieldDescription>Halves are fine, like 1.5.</FieldDescription>
              <FieldError errors={[errors.credits]} />
            </Field>
            <Controller
              control={form.control}
              name="nonCredit"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="course-non-credit"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                  <div className="space-y-1">
                    <FieldLabel htmlFor="course-non-credit">Non-credit</FieldLabel>
                    <FieldDescription>
                      Students take it, but it adds nothing to the credit totals.
                    </FieldDescription>
                  </div>
                </Field>
              )}
            />
            <Field data-invalid={Boolean(errors.category)}>
              <FieldLabel htmlFor={newCategory ? "course-category" : "course-category-pick"}>
                Category
              </FieldLabel>
              {newCategory ? (
                <>
                  <Input
                    id="course-category"
                    placeholder="New category name"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.category)}
                    {...form.register("category")}
                  />
                  {categories.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        form.setValue("category", course?.category ?? categories[0]);
                        setNewCategory(false);
                      }}
                    >
                      Pick an existing category
                    </Button>
                  ) : null}
                </>
              ) : (
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <OptionSelect
                      id="course-category-pick"
                      value={field.value}
                      onChange={(v) => {
                        if (v === NEW_CATEGORY) {
                          form.setValue("category", "");
                          setNewCategory(true);
                        } else field.onChange(v);
                      }}
                      options={[
                        ...categories.map((c) => ({ value: c, label: c })),
                        { value: NEW_CATEGORY, label: "New category..." },
                      ]}
                      invalid={Boolean(errors.category)}
                    />
                  )}
                />
              )}
              <FieldError errors={[errors.category]} />
            </Field>
            <Field data-invalid={Boolean(errors.semester)}>
              <FieldLabel htmlFor="course-semester">Semester (optional)</FieldLabel>
              <Input
                id="course-semester"
                type="number"
                inputMode="numeric"
                min="0"
                max={SEMESTER_MAX}
                step="1"
                aria-invalid={Boolean(errors.semester)}
                {...form.register("semester", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
              />
              <FieldDescription>
                Where the map suggests taking it. Leave empty if it has no set semester.
              </FieldDescription>
              <FieldError errors={[errors.semester]} />
            </Field>

            {kind === "course" ? (
              <Field data-invalid={Boolean(altError)}>
                <FieldLabel>Or take instead</FieldLabel>
                <FieldDescription>
                  Other courses that fill this slot. The map shows every code until a student takes
                  one.
                </FieldDescription>
                {alternatives.fields.map((item, i) => {
                  const rowErrors = errors.alternatives?.[i];
                  return (
                    <div key={item.id} className="flex items-start gap-2">
                      <div className="grid min-w-0 flex-1 grid-cols-[6.5rem_1fr] gap-2">
                        <div className="space-y-1">
                          <Input
                            aria-label={`Alternative ${i + 1} code`}
                            className="uppercase"
                            placeholder="BEN205"
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            aria-invalid={Boolean(rowErrors?.code)}
                            {...form.register(`alternatives.${i}.code`)}
                          />
                          <FieldError errors={[rowErrors?.code]} />
                        </div>
                        <div className="space-y-1">
                          <Input
                            aria-label={`Alternative ${i + 1} title`}
                            placeholder="Title"
                            autoComplete="off"
                            aria-invalid={Boolean(rowErrors?.title)}
                            {...form.register(`alternatives.${i}.title`)}
                          />
                          <FieldError errors={[rowErrors?.title]} />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        aria-label={`Remove alternative ${i + 1}`}
                        onClick={() => alternatives.remove(i)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  );
                })}
                <FieldError errors={[altError ? { message: altError } : undefined]} />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="self-start"
                  onClick={() => alternatives.append({ code: "", title: "" })}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add an alternative
                </Button>
              </Field>
            ) : null}

            <Field data-invalid={Boolean(errors.prereq)}>
              <FieldLabel htmlFor="course-prereq">Prerequisites</FieldLabel>
              <Textarea
                id="course-prereq"
                rows={2}
                placeholder="CSE215 and (MAT120 or MAT125)"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.prereq)}
                {...form.register("prereq")}
              />
              <FieldDescription>
                Use and, or and brackets, like CSE215 and (MAT120 or MAT125), or 60 credits
                completed. Leave empty for none.
              </FieldDescription>
              <FieldError errors={[errors.prereq]} />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              {course ? "Save changes" : "Add course"}
            </Button>
          </FieldGroup>
        </form>

        {course ? (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg leading-[1.3] font-semibold text-ink">
                {course.hidden ? "Hidden from students" : "Visibility"}
              </h3>
              <p className="text-[15px] text-soft">
                {course.hidden
                  ? "Students without a grade on it don't see this course. Grades already recorded still count."
                  : "Hiding removes this course from students' maps unless they already have a grade on it. Grades are never deleted. A course whose prerequisite names this one stays locked until you change that prerequisite."}
              </p>
              <ReasonForm
                id={`course-reason-${course.id}`}
                submitLabel={course.hidden ? "Show again" : "Hide"}
                variant="outline"
                onSubmit={(reason) =>
                  confirm.ask({
                    ...courseHiddenConfirm(course, !course.hidden, reason),
                    run: async () => {
                      await setHidden.mutateAsync({ hidden: !course.hidden, reason });
                      toast.success(course.hidden ? "Course shown again" : "Course hidden");
                      onClose();
                    },
                  })
                }
              />
            </div>
          </>
        ) : null}
      </div>
      {confirm.element}
    </>
  );
}
