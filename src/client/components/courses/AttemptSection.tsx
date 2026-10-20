import { useQuery } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/AuthForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { attemptsForCodes, attemptTermLabel, retakeStatus } from "@/lib/attempts";
import { isToastError, useDeleteAttempt } from "@/lib/courses";
import { attemptsQuery, facultyQuery } from "@/lib/queries";
import { bestAttempt, gradeLabel } from "../../../shared/grading";
import type { Attempt } from "../../../shared/schemas/attempts";
import { AttemptForm } from "./AttemptForm";

type Choice = { code: string; title: string };

/** The "Retake allowed" / "Retake not allowed" mark, shown once a course has an attempt. */
export function RetakeBadge({ allowed }: { allowed: boolean }) {
  return <Badge>{allowed ? "Retake allowed" : "Retake not allowed"}</Badge>;
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
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteAttempt();
  const label = `${gradeLabel(attempt.grade)}, ${attemptTermLabel(attempt.term)}`;

  if (editing) {
    return (
      <li className="space-y-3 py-3">
        <p className="text-sm font-medium text-ink">Edit attempt: {label}</p>
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
    setError(null);
    remove.mutate(attempt.id, {
      onSuccess: () => toast.success("Attempt deleted"),
      onError: (err) => {
        if (isToastError(err)) toast.error(errorMessage(err));
        else setError(errorMessage(err));
      },
    });
  };

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
            <span className="font-semibold tabular-nums">{gradeLabel(attempt.grade)}</span>
            {showCode ? <span className="text-soft">{attempt.courseCode}</span> : null}
            <span className="text-soft">{attemptTermLabel(attempt.term)}</span>
            {isBest ? <Badge>Best</Badge> : null}
          </p>
          {facultyName ? <p className="truncate text-sm text-soft">{facultyName}</p> : null}
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
          className="text-destructive"
          aria-label={`Delete attempt: ${label}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2Icon />
        </Button>
      </div>
      {confirming ? (
        <div className="mt-2 space-y-3 rounded-control border border-line p-3">
          <p className="text-sm text-body">
            Delete this attempt? Your CGPA and credits are worked out again without it.
          </p>
          <FormError message={error} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="lg"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={onDelete}
            >
              {remove.isPending ? "Deleting..." : "Delete attempt"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setConfirming(false)}>
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
}: {
  choices: readonly Choice[];
  onSaved: () => void;
}) {
  const attemptsResult = useQuery(attemptsQuery);
  const { data: faculty } = useQuery(facultyQuery);
  const [adding, setAdding] = useState(false);
  const [full, setFull] = useState(false);
  const codes = choices.map((c) => c.code);

  if (attemptsResult.isPending) {
    return <p className="border-t border-line pt-4 text-sm text-soft">Loading your attempts...</p>;
  }

  const attempts = attemptsForCodes(attemptsResult.data ?? [], codes);

  if (attempts.length === 0) {
    // The quick form also stands in when the history failed to load: recording must still work.
    return (
      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Record a grade</h3>
        {attemptsResult.isError ? (
          <p role="alert" className="text-sm text-soft">
            Your attempts did not load. You can still record a grade.
          </p>
        ) : null}
        <AttemptForm
          key={full ? "full" : "quick"}
          mode={full ? "full" : "quick"}
          choices={choices}
          onSaved={onSaved}
        />
        <Button type="button" variant="ghost" size="lg" onClick={() => setFull(!full)}>
          {full ? "Use the quick form" : "Add term and faculty"}
        </Button>
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
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Your attempts</h3>
        <RetakeBadge allowed={retakeAllowed} />
      </div>
      <ul className="divide-y divide-line">
        {attempts.map((a) => (
          <AttemptRow
            key={a.id}
            attempt={a}
            choices={choices}
            isBest={bestIds.has(a.id)}
            showCode={choices.length > 1}
            facultyName={faculty?.find((f) => f.id === a.facultyId)?.name ?? null}
          />
        ))}
      </ul>
      {adding && allowed.length > 0 ? (
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Add an attempt</h3>
          <AttemptForm
            mode="full"
            choices={allowed}
            onSaved={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : allowed.length > 0 ? (
        <Button variant="outline" size="lg" onClick={() => setAdding(true)}>
          Add attempt
        </Button>
      ) : null}
      {blocked.length > 0 && allowed.length === 0 ? (
        <p className="text-sm text-soft">{blocked[0].reason}</p>
      ) : null}
    </div>
  );
}
