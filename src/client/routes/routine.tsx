import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { ClassRow } from "@/components/routine/ClassRow";
import { RoutineSheet, type RoutineSheetTarget } from "@/components/routine/RoutineSheet";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import { courseMapQuery, meQuery, routineQuery } from "@/lib/queries";
import { routineCourseChoices, titleByCode, useClearRoutine, weekDays } from "@/lib/routine";
import { termLabel } from "@/lib/courseMap";
import { toast } from "@/lib/toast";
import { useNow } from "@/lib/useNow";
import { dhakaDayLetter, entryStatus } from "../../shared/routine";
import { currentTerm } from "../../shared/terms";

export const Route = createFileRoute("/routine")({
  // Signed out goes to login. Everyone else, mods and admins included, has their own routine.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (!me) throw redirect({ to: "/login" });
  },
  component: RoutinePage,
});

const flat = "rounded-control bg-tint";

function RoutinePage() {
  const routine = useQuery(routineQuery);
  const map = useQuery(courseMapQuery);
  const now = useNow();
  const [target, setTarget] = useState<RoutineSheetTarget>(null);
  const [clearing, setClearing] = useState(false);

  const entries = routine.data ?? [];
  const choices = map.data ? routineCourseChoices(map.data) : [];
  const titles = titleByCode(choices);
  const today = dhakaDayLetter(now);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Routine</h1>
          <p className="text-sm text-soft">{termLabel(currentTerm(now))}</p>
        </div>
        <Button size="lg" disabled={!routine.data} onClick={() => setTarget("new")}>
          Add class
        </Button>
      </div>

      {routine.isPending ? (
        <div aria-busy="true" role="status" aria-label="Loading your routine" className="space-y-4">
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-2">
              <div className={`h-5 w-28 ${flat}`} />
              <div className={`h-12 w-full ${flat}`} />
            </div>
          ))}
        </div>
      ) : routine.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">Your routine didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(routine.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void routine.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {entries.length === 0 ? (
            <p className="text-sm text-soft">
              Add the classes you're taking this term. Today's show on Home, in time order.
            </p>
          ) : null}
          {weekDays(entries).map(({ day, name, entries: held, clashes }) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <SectionHeader
                id={`day-${day}`}
                title={name}
                action={day === today ? <span className="text-soft">Today</span> : undefined}
              />
              {held.length === 0 ? (
                <p className="border-b border-line py-3 text-sm text-soft">No classes</p>
              ) : (
                <ul>
                  {held.map((entry) => (
                    <ClassRow
                      key={entry.id}
                      entry={entry}
                      title={titles.get(entry.courseCode)}
                      status={day === today ? entryStatus(entry, now) : "upcoming"}
                      note={
                        clashes.has(entry.id) ? (
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink">
                            <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
                            Overlaps{" "}
                            {clashes
                              .get(entry.id)
                              ?.map((c) => c.courseCode)
                              .join(", ")}
                          </p>
                        ) : null
                      }
                      action={
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={`Edit ${entry.courseCode} section ${entry.section}, ${name}`}
                          onClick={() => setTarget(entry)}
                        >
                          <PencilIcon />
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
          {entries.length > 0 ? (
            <div className="pt-2">
              <Button variant="outline" size="lg" onClick={() => setClearing(true)}>
                Clear this term
              </Button>
            </div>
          ) : null}
        </>
      )}

      <RoutineSheet
        target={target}
        entries={entries}
        choices={choices}
        onClose={() => setTarget(null)}
      />
      <ClearTermDialog open={clearing} count={entries.length} onClose={() => setClearing(false)} />
    </div>
  );
}

function ClearTermDialog({
  open,
  count,
  onClose,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
}) {
  const clear = useClearRoutine();
  const onClear = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        toast.success("Routine cleared");
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear this term's routine?</DialogTitle>
          <DialogDescription>
            This deletes all {count} {count === 1 ? "class" : "classes"} from this term. It can't be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Keep them
          </Button>
          <Button variant="destructive" size="lg" disabled={clear.isPending} onClick={onClear}>
            {clear.isPending ? "Clearing..." : "Clear routine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
