import { Link } from "@tanstack/react-router";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";
import { classDetails, formatGap, formatRange } from "@/lib/routine";
import { dhakaMinutes } from "../../../shared/time";
import { entryStatus, timeToMinutes, todayEntries } from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { ClassRow } from "./ClassRow";

/** The slice of a routine query the Home pieces need. */
export type RoutineView = {
  isPending: boolean;
  isError: boolean;
  data: RoutineEntry[] | undefined;
  refetch: () => unknown;
};

const link = `rounded-control text-brand underline-offset-4 hover:underline ${focusRing}`;
const flat = "rounded-control bg-tint";

/** The summary panel for a class: the minutes until it starts (or ends), its name and where it is. */
export function NextClassPanel({
  entry,
  title,
  now,
  className,
}: {
  entry: RoutineEntry;
  title?: string;
  now: number;
  className?: string;
}) {
  const current = entryStatus(entry, now) === "current";
  const gap = (timeToMinutes(current ? entry.end : entry.start) ?? 0) - dhakaMinutes(now);
  return (
    <section className={className} aria-labelledby="next-class-title">
      <h1 id="next-class-title" className="text-sm text-soft">
        {current ? "In class now" : "Next class"}
      </h1>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold text-ink tabular-nums">{formatGap(gap)}</span>
        <span className="text-sm text-soft">
          {current ? "left in this class" : "until it starts"}
        </span>
      </p>
      <p className="mt-4 text-base font-semibold text-ink">
        {entry.courseCode}
        {title ? <span className="font-normal text-soft"> {title}</span> : null}
      </p>
      <p className="mt-0.5 text-sm text-soft tabular-nums">
        {formatRange(entry.start, entry.end)} · {classDetails(entry)}
      </p>
    </section>
  );
}

/** A flat placeholder for the summary panel while the routine loads. */
export function NextClassSkeleton({ className }: { className?: string }) {
  return (
    <section className={className} aria-busy="true">
      <h1 className="sr-only">Home</h1>
      <div className={`h-5 w-24 ${flat}`} />
      <div className={`mt-2 h-10 w-36 ${flat}`} />
      <div className={`mt-4 h-5 w-56 ${flat}`} />
      <div className={`mt-1 h-5 w-48 ${flat}`} />
    </section>
  );
}

/** Today's classes in time order, with a link to the full week. */
export function TodaySection({
  routine,
  titles,
  now,
}: {
  routine: RoutineView;
  titles: ReadonlyMap<string, string>;
  now: number;
}) {
  const today = routine.data ? todayEntries(routine.data, now) : [];
  return (
    <section aria-label="Today">
      <SectionHeader
        title="Today"
        action={
          <Link to="/routine" className={link}>
            Full routine
          </Link>
        }
      />
      {routine.isPending ? (
        <div aria-busy="true" role="status" aria-label="Loading today's classes">
          {[0, 1].map((n) => (
            <div key={n} className="flex gap-3 border-b border-line py-3">
              <div className={`h-10 w-16 ${flat}`} />
              <div className={`h-10 flex-1 ${flat}`} />
            </div>
          ))}
        </div>
      ) : routine.isError ? (
        <div className="space-y-3 py-4 text-sm text-soft">
          <p>Today's classes didn't load. Check your connection and try again.</p>
          <Button variant="outline" onClick={() => void routine.refetch()}>
            Retry
          </Button>
        </div>
      ) : routine.data?.length === 0 ? (
        <p className="py-4 text-sm text-soft">
          Add the classes you're taking this term and today's will show up here.{" "}
          <Link to="/routine" className={`${link} underline`}>
            Add your routine
          </Link>
        </p>
      ) : today.length === 0 ? (
        <p className="py-4 text-sm text-soft">No classes today.</p>
      ) : (
        <ul>
          {today.map((entry) => (
            <ClassRow
              key={entry.id}
              entry={entry}
              title={titles.get(entry.courseCode)}
              status={entryStatus(entry, now)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
