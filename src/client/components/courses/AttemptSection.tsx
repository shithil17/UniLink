import { useQuery } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { attemptsForCodes, attemptTermLabel, retakeStatus } from "@/lib/attempts";
import { useDeleteAttempt } from "@/lib/courses";
import { attemptsQuery } from "@/lib/queries";
import { facultyTitle } from "../../../shared/facultySearch";
import { bestAttempt, gradeLabel } from "../../../shared/grading";
import type { Attempt } from "../../../shared/schemas/attempts";
import { AttemptForm } from "./AttemptForm";
import { CourseCode } from "./CourseCode";

type Choice = { code: string; title: string };

/** The "Retake allowed" / "Retake not allowed" mark, shown once a course has an attempt. */
export function RetakeBadge({ allowed }: { allowed: boolean }) {
  return (
    <Badge variant={allowed ? "soft" : "outline"}>
      {allowed ? "Retake allowed" : "Retake not allowed"}
    </Badge>
  );
}

function AttemptRow({
  attempt,
  choices,
  isBest,
  showCode,
  facultyName,
}: {
  attempt: Attempt;
  choices: readonly Choice[];
  isBest: boolean;
  showCode: boolean;
  facultyName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteAttempt();
  const label = `${gradeLabel(attempt.grade)}, ${attemptTermLabel(attempt.term)}`;

  if (editing) {
    return (
      <li className="space-y-3 py-4">
        <p className="text-[15px] font-medium text-ink">Edit attempt: {label}</p>
        <AttemptForm
          mode="full"
          attempt={attempt}
          choices={choices.filter((c) => c.code === attempt.courseCode)}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const onDelete = () => {
    remove.mutate(attempt.id, {
      onSuccess: () => toast.success("Attempt deleted"),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <li className="py-2">
      <div className="flex min-h-12 items-center gap-1">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink">
            <span className="font-semibold tabular-nums">{gradeLabel(attempt.grade)}</span>
            {showCode ? <CourseCode code={attempt.courseCode} /> : null}
            <span className="text-soft">{attemptTermLabel(attempt.term)}</span>
            {isBest ? <Badge variant="soft">Best</Badge> : null}
          </p>
          {facultyName ? <p className="truncate text-[13px] text-faint">{facultyName}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={`Edit attempt: ${label}`}
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="text-danger"
          aria-label={`Delete attempt: ${label}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2Icon />
        </Button>
      </div>
      {confirming ? (
        <div className="mt-2 grid gap-3 rounded-row bg-app p-4">
          <p className="text-[15px] text-ink">
            Delete this attempt? Your CGPA and credits are worked out again without it.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="destructive" disabled={remove.isPending} onClick={onDelete}>
              {remove.isPending ? "Deleting..." : "Delete attempt"}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Everything the course sheet offers for grades. With no attempt yet it is the quick form (the map's
 * tick); with attempts it is the history, the retake state and the full "Add attempt" form.
 */
export function AttemptSection({
  choices,
  onSaved,
  locked = false,
}: {
  choices: readonly Choice[];
  /** Called after a first grade is recorded; the course sheet closes on it. */
  onSaved: () => void;
  /** The prerequisites are not met: recording a first grade is disabled. */
  locked?: boolean;
}) {
  const attemptsResult = useQuery(attemptsQuery);
  const [adding, setAdding] = useState(false);
  const [full, setFull] = useState(false);
  const codes = choices.map((c) => c.code);

  useEffect(() => {
    if (attemptsResult.isError) {
      toast.error("Your attempts did not load. You can still record a grade.", {
        id: "attempts-load",
      });
    }
  }, [attemptsResult.isError]);

  if (attemptsResult.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-3">
        <span className="sr-only">Loading your attempts</span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-13 w-full" />
      </div>
    );
  }

  const attempts = attemptsForCodes(attemptsResult.data ?? [], codes);

  if (attempts.length === 0) {
    // The quick form also stands in when the history failed to load: recording must still work.
    // One form instance for both shapes, so a grade or term picked in the quick form survives the toggle.
    return (
      <div className="grid gap-3">
        <AttemptForm
          mode={full ? "full" : "quick"}
          choices={choices}
          locked={locked}
          confirmAfterSheetCloses
          onSaved={onSaved}
        />
        {locked ? null : (
          <Button type="button" variant="ghost" onClick={() => setFull(!full)}>
            {full ? "Use the quick form" : "Add term and faculty"}
          </Button>
        )}
      </div>
    );
  }

  const status = choices.map((c) => ({ ...c, ...retakeStatus(attemptsResult.data ?? [], c.code) }));
  const allowed = status.filter((s) => s.allowed);
  const blocked = status.filter((s) => !s.allowed);
  const withAttempts = choices.filter((c) => attempts.some((a) => a.courseCode === c.code));
  const retakeAllowed = status.some(
    (s) => s.allowed && withAttempts.some((c) => c.code === s.code),
  );
  const bestIds = new Set(
    codes.flatMap((code) => {
      const best = bestAttempt(attempts.filter((a) => a.courseCode === code));
      return best ? [best.id] : [];
    }),
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Your attempts</h3>
        <RetakeBadge allowed={retakeAllowed} />
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {attempts.map((a) => (
          <AttemptRow
            key={a.id}
            attempt={a}
            choices={choices}
            isBest={bestIds.has(a.id)}
            showCode={choices.length > 1}
            facultyName={a.faculty ? facultyTitle(a.faculty) : null}
          />
        ))}
      </ul>
      {adding && allowed.length > 0 ? (
        <div className="grid gap-3">
          <h3 className="text-[15px] font-semibold text-ink">Add an attempt</h3>
          <AttemptForm
            mode="full"
            choices={allowed}
            onSaved={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : allowed.length > 0 ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add attempt
        </Button>
      ) : null}
      {blocked.length > 0 && allowed.length === 0 ? (
        <p className="text-[13px] text-soft">{blocked[0].reason}</p>
      ) : null}
    </div>
  );
}
