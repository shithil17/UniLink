import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { CoursePicker } from "@/components/courses/CoursePicker";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import type { CourseChoice } from "@/lib/courseSearch";
import {
  clashesFor,
  formatRange,
  useAddRoutineEntry,
  useDeleteRoutineEntry,
  useUpdateRoutineEntry,
} from "@/lib/routine";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ROUTINE_DAY_NAMES, ROUTINE_DAYS, type RoutineDay } from "../../../shared/routine";
import {
  ROUTINE_INITIALS_MAX_LENGTH,
  ROUTINE_ROOM_MAX_LENGTH,
  ROUTINE_SECTION_MAX,
  routineInput,
  type RoutineEntry,
  type RoutineInput,
} from "../../../shared/schemas/routine";

type FormValues = z.input<typeof routineInput>;
type Choice = CourseChoice;

/** A new class with its day and times filled in, from a tap on an empty slot of the calendar. */
export type ClassPreset = { days: RoutineDay[]; start: string; end: string };

/** What the sheet shows: a new class (`"new"` or a preset), a saved one to edit, or nothing (closed). */
export type RoutineSheetTarget = RoutineEntry | ClassPreset | "new" | null;

const isSaved = (target: RoutineEntry | ClassPreset | "new"): target is RoutineEntry =>
  typeof target === "object" && "id" in target;

export function RoutineSheet({
  target,
  entries,
  choices,
  onClose,
}: {
  target: RoutineSheetTarget;
  /** Every class in the term, to warn about overlaps. */
  entries: readonly RoutineEntry[];
  choices: readonly Choice[];
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {target ? (
          <RoutineEditor
            key={isSaved(target) ? target.id : "new"}
            entry={isSaved(target) ? target : null}
            preset={isSaved(target) || target === "new" ? null : target}
            entries={entries}
            choices={choices}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** A time field's own message for a blank, the schema's for anything else (like the end rule). */
const timeError = (error: { message?: string } | undefined, blank: string) =>
  error && { message: error.message?.startsWith("Use a time") ? blank : error.message };

function RoutineEditor({
  entry,
  preset,
  entries,
  choices,
  onClose,
}: {
  entry: RoutineEntry | null;
  preset: ClassPreset | null;
  entries: readonly RoutineEntry[];
  choices: readonly Choice[];
  onClose: () => void;
}) {
  const add = useAddRoutineEntry();
  const edit = useUpdateRoutineEntry(entry?.id ?? 0);
  const remove = useDeleteRoutineEntry(entry?.id ?? 0);
  const [confirming, setConfirming] = useState(false);
  // A class whose course left the picker (a deleted course) still has to show and save.
  const options =
    entry && !choices.some((c) => c.code === entry.courseCode)
      ? [...choices, { code: entry.courseCode, title: "" }]
      : choices;

  const form = useForm<FormValues, unknown, RoutineInput>({
    resolver: zodResolver(routineInput),
    defaultValues: entry
      ? {
          courseCode: entry.courseCode,
          section: entry.section,
          days: entry.days,
          start: entry.start,
          end: entry.end,
          room: entry.room,
          initials: entry.initials,
        }
      : { courseCode: "", days: [], start: "", end: "", room: "", initials: "", ...preset },
  });
  const { errors } = form.formState;
  const pending = add.isPending || edit.isPending;

  const days = useWatch({ control: form.control, name: "days" }) ?? [];
  const start = useWatch({ control: form.control, name: "start" }) ?? "";
  const end = useWatch({ control: form.control, name: "end" }) ?? "";
  const clashes = clashesFor({ id: entry?.id ?? 0, days, start, end }, entries);

  const submit = form.handleSubmit((values) => {
    const done = {
      onSuccess: () => {
        toast.success(entry ? "Class updated" : "Class added");
        onClose();
      },
      onError: (err: unknown) => toast.error(errorMessage(err)),
    };
    if (entry) edit.mutate(values, done);
    else add.mutate(values, done);
  });

  const onDelete = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("Class deleted");
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{entry ? "Edit class" : "Add a class"}</SheetTitle>
        <SheetDescription>Times are Dhaka time. Only you can see your routine.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-5 pb-4">
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.courseCode)}>
              <FieldLabel htmlFor="routine-course">Course</FieldLabel>
              <Controller
                control={form.control}
                name="courseCode"
                render={({ field }) => (
                  <CoursePicker
                    id="routine-course"
                    value={field.value || null}
                    onChange={field.onChange}
                    choices={options}
                    title="Which course is this class?"
                    disabled={options.length === 0}
                    invalid={Boolean(errors.courseCode)}
                  />
                )}
              />
              {options.length === 0 ? (
                <FieldDescription>
                  Add your courses on the course map first, then pick them here.
                </FieldDescription>
              ) : null}
              <FieldError
                errors={[errors.courseCode && { message: "Pick the course for this class" }]}
              />
            </Field>
            <Field data-invalid={Boolean(errors.section)}>
              <FieldLabel htmlFor="routine-section">Section</FieldLabel>
              <Input
                id="routine-section"
                type="number"
                inputMode="numeric"
                min={1}
                max={ROUTINE_SECTION_MAX}
                className="h-11"
                aria-invalid={Boolean(errors.section)}
                {...form.register("section", { valueAsNumber: true })}
              />
              <FieldError
                errors={[
                  errors.section && {
                    message: `Enter the section number, 1 to ${ROUTINE_SECTION_MAX}`,
                  },
                ]}
              />
            </Field>
            <FieldSet data-invalid={Boolean(errors.days)}>
              <FieldLegend variant="label">Days</FieldLegend>
              <Controller
                control={form.control}
                name="days"
                render={({ field }) => (
                  <DayPicker value={field.value ?? []} onChange={field.onChange} />
                )}
              />
              <FieldDescription>
                {days.length > 0
                  ? days.map((d) => ROUTINE_DAY_NAMES[d]).join(", ")
                  : "The letters NSU prints: S is Sunday, R is Thursday, A is Saturday."}
              </FieldDescription>
              <FieldError errors={[errors.days && { message: "Pick at least one day" }]} />
            </FieldSet>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.start)}>
                <FieldLabel htmlFor="routine-start">Starts</FieldLabel>
                <Input
                  id="routine-start"
                  type="time"
                  className="h-11"
                  aria-invalid={Boolean(errors.start)}
                  {...form.register("start")}
                />
                <FieldError errors={[timeError(errors.start, "Pick a start time")]} />
              </Field>
              <Field data-invalid={Boolean(errors.end)}>
                <FieldLabel htmlFor="routine-end">Ends</FieldLabel>
                <Input
                  id="routine-end"
                  type="time"
                  className="h-11"
                  aria-invalid={Boolean(errors.end)}
                  {...form.register("end")}
                />
                <FieldError errors={[timeError(errors.end, "Pick an end time")]} />
              </Field>
            </div>
            {clashes.length > 0 ? <ClashWarning days={days} clashes={clashes} /> : null}
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.room)}>
                <FieldLabel htmlFor="routine-room">Room (optional)</FieldLabel>
                <Input
                  id="routine-room"
                  className="h-11"
                  autoComplete="off"
                  maxLength={ROUTINE_ROOM_MAX_LENGTH}
                  aria-invalid={Boolean(errors.room)}
                  {...form.register("room")}
                />
                <FieldError errors={[errors.room]} />
              </Field>
              <Field data-invalid={Boolean(errors.initials)}>
                <FieldLabel htmlFor="routine-initials">Faculty (optional)</FieldLabel>
                <Input
                  id="routine-initials"
                  className="h-11"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={ROUTINE_INITIALS_MAX_LENGTH}
                  aria-invalid={Boolean(errors.initials)}
                  {...form.register("initials")}
                />
                <FieldError errors={[errors.initials]} />
              </Field>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Saving..." : entry ? "Save changes" : "Add class"}
            </Button>
          </FieldGroup>
        </form>
        {entry ? (
          confirming ? (
            <div className="space-y-3 rounded-control border border-line p-3">
              <p className="text-sm text-body">Delete this class from your routine?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={onDelete}
                >
                  {remove.isPending ? "Deleting..." : "Delete class"}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="w-full text-destructive"
              onClick={() => setConfirming(true)}
            >
              Delete class
            </Button>
          )
        ) : null}
      </div>
    </>
  );
}

/** Seven toggles, one per NSU day letter. The pressed state shows by fill and weight, not color alone. */
function DayPicker({
  value,
  onChange,
}: {
  value: readonly RoutineDay[];
  onChange: (days: RoutineDay[]) => void;
}) {
  // Always in week order, so the saved days read the same however they were picked.
  const toggle = (day: RoutineDay) =>
    onChange(ROUTINE_DAYS.filter((d) => (d === day ? !value.includes(d) : value.includes(d))));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {ROUTINE_DAYS.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={ROUTINE_DAY_NAMES[day]}
            onClick={() => toggle(day)}
            className={cn(
              "h-11 rounded-control border text-sm transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand",
              on
                ? "border-brand bg-brand-soft font-semibold text-ink"
                : "border-input bg-surface text-soft hover:bg-tint",
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/** Names the classes this one would clash with and the days. It never blocks saving. */
function ClashWarning({
  days,
  clashes,
}: {
  days: readonly RoutineDay[];
  clashes: readonly RoutineEntry[];
}) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-control bg-tint p-3 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
      <div className="space-y-0.5 text-ink">
        <p className="font-medium">This overlaps another class. You can still save it.</p>
        <ul className="text-soft">
          {clashes.map((c) => (
            <li key={c.id}>
              {c.courseCode} section {c.section}, {sharedDays(days, c)}{" "}
              {formatRange(c.start, c.end)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const sharedDays = (days: readonly RoutineDay[], other: RoutineEntry) =>
  days
    .filter((d) => other.days.includes(d))
    .map((d) => ROUTINE_DAY_NAMES[d].slice(0, 3))
    .join(", ");
