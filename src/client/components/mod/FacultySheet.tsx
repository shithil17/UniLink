import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { Button } from "@/components/ui/button";
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
import { ApiError, errorMessage } from "@/lib/api";
import { changedFields, useAddFaculty, useEditFaculty, useSetFacultyHidden } from "@/lib/faculty";
import {
  facultyAddConfirm,
  facultyEditConfirm,
  facultyHiddenConfirm,
  NOTHING_TO_SAVE,
} from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { DEPARTMENTS } from "../../../shared/departments";
import {
  FACULTY_INITIALS_MAX_LENGTH,
  facultyInput,
  type FacultyFormValues,
  type FacultyInput,
  type ModFaculty,
} from "../../../shared/schemas/faculty";
import { useConfirm } from "@/lib/useConfirm";
import { ReasonForm } from "./ReasonForm";

const departmentChoices = DEPARTMENTS.map((d) => ({
  value: d.code,
  label: `${d.code} · ${d.name}`,
}));

/** What the sheet is showing: a new faculty member (`"new"`), an existing one, or nothing (closed). */
export type FacultySheetTarget = ModFaculty | "new" | null;

export function FacultySheet({
  target,
  onClose,
}: {
  target: FacultySheetTarget;
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {target ? (
          <FacultyEditor
            key={target === "new" ? "new" : target.id}
            faculty={target === "new" ? null : target}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FacultyEditor({ faculty, onClose }: { faculty: ModFaculty | null; onClose: () => void }) {
  const add = useAddFaculty();
  const edit = useEditFaculty(faculty?.id ?? 0);
  const setHidden = useSetFacultyHidden(faculty?.id ?? 0);
  const form = useForm<FacultyFormValues, unknown, FacultyInput>({
    resolver: zodResolver(facultyInput),
    defaultValues: {
      name: faculty?.name ?? "",
      initials: faculty?.initials ?? "",
      designation: faculty?.designation ?? "",
      department: faculty?.department,
      nsuPage: faculty?.nsuPage ?? "",
    },
  });
  const { errors } = form.formState;
  const confirm = useConfirm();

  // A taken name or initials is also marked on its own field, where the mod can fix it once the
  // confirm sheet is closed. The error is thrown on, so the sheet shows it too.
  const fail = (err: unknown): never => {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "initials_taken" || code === "name_taken") {
      form.setError(code === "initials_taken" ? "initials" : "name", {
        message: errorMessage(err),
      });
    }
    throw err;
  };

  // The form checks the values, then the confirm sheet says what will change. Only its button sends.
  const submit = form.handleSubmit((values) => {
    if (!faculty) {
      confirm.ask({
        ...facultyAddConfirm(values),
        run: async () => {
          await add.mutateAsync(values).catch(fail);
          toast.success("Faculty added");
          onClose();
        },
      });
      return;
    }
    const patch = changedFields(faculty, values);
    if (Object.keys(patch).length === 0) {
      toast(NOTHING_TO_SAVE);
      return;
    }
    confirm.ask({
      ...facultyEditConfirm(faculty, patch),
      run: async () => {
        await edit.mutateAsync(patch).catch(fail);
        toast.success("Faculty updated");
        onClose();
      },
    });
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{faculty ? "Edit faculty" : "Add faculty"}</SheetTitle>
        <SheetDescription>
          {faculty
            ? "Changes show for students right away."
            : "New faculty show in the picker right away."}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-5 pb-4">
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="faculty-name">Name</FieldLabel>
              <Input
                id="faculty-name"
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.initials)}>
              <FieldLabel htmlFor="faculty-initials">Initials (optional)</FieldLabel>
              <Input
                id="faculty-initials"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={FACULTY_INITIALS_MAX_LENGTH}
                aria-invalid={Boolean(errors.initials)}
                {...form.register("initials")}
              />
              <FieldDescription>
                The code NSU prints, like RkZ. Leave it empty if the department doesn't publish one.
              </FieldDescription>
              <FieldError errors={[errors.initials]} />
            </Field>
            <Field data-invalid={Boolean(errors.designation)}>
              <FieldLabel htmlFor="faculty-designation">Designation</FieldLabel>
              <Input
                id="faculty-designation"
                autoComplete="off"
                aria-invalid={Boolean(errors.designation)}
                {...form.register("designation")}
              />
              <FieldError errors={[errors.designation]} />
            </Field>
            <Field data-invalid={Boolean(errors.department)}>
              <FieldLabel htmlFor="faculty-department">Department</FieldLabel>
              <Controller
                control={form.control}
                name="department"
                render={({ field }) => (
                  <OptionSelect
                    id="faculty-department"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    options={departmentChoices}
                    placeholder="Pick a department"
                    invalid={Boolean(errors.department)}
                  />
                )}
              />
              <FieldError errors={[errors.department]} />
            </Field>
            <Field data-invalid={Boolean(errors.nsuPage)}>
              <FieldLabel htmlFor="faculty-page">NSU page (optional)</FieldLabel>
              <Input
                id="faculty-page"
                type="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(errors.nsuPage)}
                {...form.register("nsuPage")}
              />
              <FieldDescription>The profile link on northsouth.edu.</FieldDescription>
              <FieldError errors={[errors.nsuPage]} />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              {faculty ? "Save changes" : "Add faculty"}
            </Button>
          </FieldGroup>
        </form>

        {faculty ? (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg leading-[1.3] font-semibold text-ink">
                {faculty.hidden ? "Hidden from students" : "Visibility"}
              </h3>
              <p className="text-[15px] text-soft">
                {faculty.hidden
                  ? "Students can't pick this person. Attempts that already name them still do."
                  : "Hiding removes this person from the picker. Attempts that already name them keep the name."}
              </p>
              <ReasonForm
                id={`faculty-reason-${faculty.id}`}
                submitLabel={faculty.hidden ? "Show again" : "Hide"}
                variant="outline"
                onSubmit={(reason) =>
                  confirm.ask({
                    ...facultyHiddenConfirm(faculty, !faculty.hidden, reason),
                    run: async () => {
                      await setHidden.mutateAsync({ hidden: !faculty.hidden, reason });
                      toast.success(faculty.hidden ? "Faculty shown again" : "Faculty hidden");
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
