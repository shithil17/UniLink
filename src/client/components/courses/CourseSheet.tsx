import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/AuthForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { formatCredits, slotCodeChoices } from "@/lib/courseMap";
import { isToastError, useDeleteStudentCourse } from "@/lib/courses";
import type { CourseMap } from "../../../shared/schemas/courses";
import { AttemptForm } from "./AttemptForm";
import { PrereqText } from "./PrereqText";
import { DoneChip, StatusChip } from "./StatusChip";
import { StudentCourseForm } from "./StudentCourseForm";

type Slot = CourseMap["categories"][number]["slots"][number];
type MapStudentCourse = CourseMap["extras"][number];

export type SheetTarget =
  | { type: "slot"; slot: Slot }
  | { type: "extra"; course: MapStudentCourse }
  | { type: "add"; category: string };

/** Everything a tap on the course map opens: slot details, a student course, or the add form. */
export function CourseSheet({
  target,
  categories,
  onClose,
}: {
  target: SheetTarget | null;
  categories: readonly string[];
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto md:mx-auto md:max-w-lg">
        {target?.type === "add" ? (
          <>
            <SheetHeader>
              <SheetTitle>Add a course</SheetTitle>
              <SheetDescription>It fills the next open elective in its category.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <StudentCourseForm
                categories={categories}
                initial={{ category: target.category }}
                onSaved={onClose}
                onCancel={onClose}
              />
            </div>
          </>
        ) : target?.type === "extra" ? (
          <StudentCourseDetails course={target.course} categories={categories} onClose={onClose} />
        ) : target?.type === "slot" ? (
          target.slot.studentCourse ? (
            <StudentCourseDetails
              course={target.slot.studentCourse}
              categories={categories}
              onClose={onClose}
            />
          ) : (
            <SlotDetails slot={target.slot} onClose={onClose} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SlotDetails({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const choices = slotCodeChoices(slot);
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {slot.code} {slot.title}
        </SheetTitle>
        <SheetDescription>
          {slot.nonCredit ? "Non-credit" : `${formatCredits(slot.credits)} credits`} ·{" "}
          {slot.category}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={slot.status} />
          {slot.filledBy && slot.filledBy !== slot.code ? (
            <span className="text-sm text-soft">Taken as {slot.filledBy}</span>
          ) : null}
        </div>
        {slot.alternatives.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-soft">Or take instead</h3>
            <ul className="text-sm text-body">
              {slot.alternatives.map((a) => (
                <li key={a.code}>
                  {a.code} {a.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <PrereqText rule={slot.prereq} />
        {slot.status === "locked" ? (
          <p className="text-sm text-soft">Prerequisites are not met yet.</p>
        ) : null}
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Record a grade</h3>
          <AttemptForm choices={choices} onSaved={onClose} />
        </div>
      </div>
    </>
  );
}

function StudentCourseDetails({
  course,
  categories,
  onClose,
}: {
  course: MapStudentCourse;
  categories: readonly string[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useDeleteStudentCourse();

  if (editing) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Edit {course.code}</SheetTitle>
          <SheetDescription>Your own course in {course.category}.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <StudentCourseForm
            categories={categories}
            initial={{ category: course.category }}
            existing={course}
            onSaved={onClose}
            onCancel={() => setEditing(false)}
          />
        </div>
      </>
    );
  }

  const onDelete = () => {
    setDeleteError(null);
    remove.mutate(course.id, {
      onSuccess: () => {
        toast.success("Deleted");
        onClose();
      },
      onError: (err) => {
        if (isToastError(err)) toast.error(errorMessage(err));
        else setDeleteError(errorMessage(err));
      },
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {course.code} {course.title}
        </SheetTitle>
        <SheetDescription>
          {formatCredits(course.credits)} credits · {course.category} · your own course
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <DoneChip done={course.done} />
          {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
        </div>
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Record a grade</h3>
          <AttemptForm choices={[course]} onSaved={onClose} />
        </div>
        <div className="space-y-3 border-t border-line pt-4">
          {confirmingDelete ? (
            <>
              <p className="text-sm text-body">Delete {course.code}? Its grades are deleted too.</p>
              <FormError message={deleteError} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="destructive"
                  className="h-11"
                  disabled={remove.isPending}
                  onClick={onDelete}
                >
                  {remove.isPending ? "Deleting..." : "Delete course"}
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
                Edit course
              </Button>
              <Button
                variant="outline"
                className="h-11 text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete course
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
