import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CalendarPlusIcon, ClockIcon } from "lucide-react";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRing } from "@/components/ui/focus";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock, formatGap } from "@/lib/routine";
import { cn } from "@/lib/utils";
import { dhakaMinutes } from "../../../shared/time";
import { entryStatus, timeToMinutes, todayEntries } from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { ClassRow } from "./ClassRow";
import { NowMarker } from "./NowMarker";
import { hourLabel, hoursFromTop, nowOffset, timelineRange, type TimelineRange } from "./timeline";

/** The slice of a routine query the Home pieces need. */
export type RoutineView = {
  isPending: boolean;
  isError: boolean;
  data: RoutineEntry[] | undefined;
  refetch: () => unknown;
};

const link = `rounded-control text-brand-ink underline underline-offset-4 ${focusRing}`;

/**
 * A compact pill for Home's header: "In class now" with the minutes left, or "Next class" with its
 * start and the wait. The course title is read out for screen readers only, to keep the pill short.
 */
export function NextClassPill({
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
    <p
      data-slot="next-class-pill"
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] leading-[1.3] font-semibold text-brand-ink tabular-nums",
        className,
      )}
    >
      <ClockIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
      <span>{current ? "In class now" : "Next class"}</span>
      <span aria-hidden>·</span>
      <span>
        {entry.courseCode}
        {title ? <span className="sr-only"> {title}</span> : null}
        {current ? null : ` at ${formatClock(entry.start)}`}
      </span>
      <span aria-hidden>·</span>
      <span>{current ? `${formatGap(gap)} left` : `in ${formatGap(gap)}`}</span>
    </p>
  );
}

/**
 * The day as a timeline: an hour axis, hairlines, one hue block per class placed by its time (52px
 * an hour, 56px from `xl`) and the now marker while the time is inside the hours shown.
 * ceiling: classes that overlap in time stack on top of each other; the routine screen already warns
 * about clashes, and a side-by-side layout would justify itself only if clashes became common.
 */
function DayTimeline({
  entries,
  range,
  titles,
  now,
}: {
  entries: readonly RoutineEntry[];
  range: TimelineRange;
  titles: ReadonlyMap<string, string>;
  now: number;
}) {
  const hours = range.to - range.from;
  const marker = nowOffset(range, now);
  const nextId = entries.find((e) => entryStatus(e, now) === "upcoming")?.id;
  return (
    <div className="py-2.5">
      <div
        data-slot="timeline"
        style={{ "--n": hours } as React.CSSProperties}
        className="relative h-[calc(var(--hh)_*_var(--n))] [--hh:52px] xl:[--hh:56px]"
      >
        <span
          aria-hidden
          className="absolute top-0 bottom-0 left-[51px] w-0.5 rounded-sm bg-line"
        />
        {Array.from({ length: hours + 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden
            style={{ "--at": i } as React.CSSProperties}
            className="absolute inset-x-0 h-0 top-[calc(var(--hh)_*_var(--at))]"
          >
            <span className="absolute top-[-9px] left-0 w-11 pr-1.5 text-right text-xs leading-[18px] font-semibold whitespace-nowrap text-soft">
              {hourLabel(range.from + i)}
            </span>
            <span className="absolute right-0 left-[58px] h-px bg-line opacity-70" />
          </div>
        ))}
        <ol className="absolute inset-0">
          {entries.map((entry) => (
            <ClassRow
              key={entry.id}
              entry={entry}
              title={titles.get(entry.courseCode)}
              status={entryStatus(entry, now)}
              next={entry.id === nextId}
              top={hoursFromTop(range, timeToMinutes(entry.start) ?? 0)}
              span={((timeToMinutes(entry.end) ?? 0) - (timeToMinutes(entry.start) ?? 0)) / 60}
            />
          ))}
        </ol>
        {marker === null ? null : <NowMarker offset={marker} now={now} />}
      </div>
    </div>
  );
}

/** Today's classes on a timeline, with a link to the full week. */
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
  const range = timelineRange(today);
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
        <div
          role="status"
          aria-busy="true"
          data-slot="timeline-skeleton"
          className="grid gap-3 py-2.5 pl-[68px]"
        >
          <span className="sr-only">Loading today's classes</span>
          {/* 16px matches the class block radius (`rounded-row`); an arbitrary value so it wins the merge. */}
          <Skeleton className="h-[100px] rounded-[16px]" />
          <Skeleton className="h-[76px] rounded-[16px]" />
        </div>
      ) : routine.isError ? (
        <ErrorBlock
          title="Today's classes didn't load"
          message="Check your connection and try again."
          onRetry={() => void routine.refetch()}
        />
      ) : routine.data?.length === 0 ? (
        <EmptyState
          icon={CalendarPlusIcon}
          title="No routine yet"
          description="Add the classes you're taking this term and today's will show up here."
          action={
            <Link to="/routine" className={link}>
              Add your routine
            </Link>
          }
        />
      ) : !range ? (
        <EmptyState icon={CalendarDaysIcon} title="No classes today." />
      ) : (
        <DayTimeline entries={today} range={range} titles={titles} now={now} />
      )}
    </section>
  );
}
