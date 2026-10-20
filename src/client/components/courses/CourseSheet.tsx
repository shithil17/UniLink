import { useState } from "react";
import { toast } from "@/lib/toast";
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
import { useDeleteStudentCourse } from "@/lib/courses";
import type { CourseMap } from "../../../shared/schemas/courses";
import { slotLabel } from "../../../shared/slotChoice";
import { AttemptSection } from "./AttemptSection";
import { PrereqText } from "./PrereqText";
import { StateMark } from "./StateMark";
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
      <SheetContent side="bottom">
        {target?.type === "add" ? (
          <>
            <SheetHeader>
              <SheetTitle>Add a course</SheetTitle>
              <SheetDescription>It fills the next open elective in its category.</SheetDescription>
            </SheetHeader>
            <div className="px-4">
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
  const label = slotLabel(slot);
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {label.code} {label.title}
        </SheetTitle>
        <SheetDescription>
          {slot.nonCredit ? "Non-credit" : `${formatCredits(slot.credits)} credits`} ·{" "}
          {slot.category}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <StateMark showLabel status={slot.status} waived={slot.waived} />
        </div>
        {label.others.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-soft">
              {label.chosen ? "Other choices for this slot" : "Or take instead"}
            </h3>
            <ul className="text-sm text-body">
              {label.others.map((a) => (
                <li key={a.code}>
                  {a.code} {a.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <PrereqText rule={slot.prereq} />
        {slot.status === "locked" ? (
          <p className="text-sm text-soft">You haven't met the prerequisites yet.</p>
        ) : null}
        <AttemptSection choices={choices} onSaved={onClose} />
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
  const remove = useDeleteStudentCourse();

  if (editing) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Edit {course.code}</SheetTitle>
          <SheetDescription>Your own course in {course.category}.</SheetDescription>
        </SheetHeader>
        <div className="px-4">
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
    remove.mutate(course.id, {
      onSuccess: () => {
        toast.success("Course deleted");
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
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
      <div className="space-y-5 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <StateMark showLabel status={course.done ? "done" : "available"} waived={course.waived} />
          {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
        </div>
        <AttemptSection choices={[course]} onSaved={onClose} />
        <div className="space-y-3 border-t border-line pt-4">
          {confirmingDelete ? (
            <>
              <p className="text-sm text-body">Delete {course.code}? Its grades are deleted too.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={onDelete}
                >
                  {remove.isPending ? "Deleting..." : "Delete course"}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
                Edit course
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-destructive"
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
