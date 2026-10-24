import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CgpaTile, CreditsTile } from "@/components/courses/CgpaSummary";
import { CourseCode } from "@/components/courses/CourseCode";
import { StateMark } from "@/components/courses/StateMark";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { NextClassPill, TodaySection, type RoutineView } from "@/components/routine/TodaySection";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRing } from "@/components/ui/focus";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { courseHue } from "@/lib/courseHue";
import { formatCredits } from "@/lib/courseMap";
import {
  dhakaDateLine,
  greeting,
  selectHomeState,
  unlockedNext,
  UNLOCKED_NEXT_MAX,
} from "@/lib/home";
import { cgpaSummaryQuery, courseMapQuery, meQuery, routineQuery } from "@/lib/queries";
import { nextClassOf, routineCourseChoices, titleByCode } from "@/lib/routine";
import { useNow } from "@/lib/useNow";
import { staggerRow, useStagger } from "@/lib/useStagger";
import { cn } from "@/lib/utils";
import type { CourseMap } from "../../shared/schemas/courses";
import { slotLabel } from "../../shared/slotChoice";

export const Route = createFileRoute("/")({
  component: Home,
});

/** A flat panel: `surface`, radius 20 (24 from `md`), no border, rows carry their own hairlines. */
const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";
/** The text-only panels (welcome, notices) pad their content. */
const padded = `${panel} p-5`;

function Home() {
  const me = useQuery(meQuery);
  const map = useQuery({ ...courseMapQuery, enabled: me.data != null });
  const state = selectHomeState(me, map);
  // Every signed-in user has their own routine, mods and admins included.
  const routine = useQuery({ ...routineQuery, enabled: me.data != null });
  // The CGPA tile has its own query so a slow or failed summary never holds Home back.
  const cgpa = useQuery({ ...cgpaSummaryQuery, enabled: me.data != null });
  const now = useNow();
  const animate = useStagger("/");

  const retry = () => {
    void (me.isError ? me.refetch() : map.refetch());
  };

  if (state === "loading") return <HomeLoading />;
  if (state === "signedOut") return <SignedOut />;
  if (state === "error") {
    return <HomeError onRetry={retry} retrying={me.isFetching || map.isFetching} />;
  }

  const name = me.data?.username;
  if (state === "empty" || !map.data) {
    return (
      <HomeGrid
        header={<HomeHeader now={now} name={name} routine={routine} />}
        main={
          <>
            <NoCurriculum />
            <TodaySection routine={routine} titles={new Map()} now={now} />
          </>
        }
      />
    );
  }

  const titles = titleByCode(routineCourseChoices(map.data));
  return (
    <HomeGrid
      header={<HomeHeader now={now} name={name} routine={routine} titles={titles} />}
      main={<TodaySection routine={routine} titles={titles} now={now} />}
      side={
        <>
          <section aria-label="Degree standing" className="grid grid-cols-2 gap-3">
            <CgpaTile
              summary={cgpa.data}
              isError={cgpa.isError}
              onRetry={() => void cgpa.refetch()}
            />
            <CreditsTile earned={map.data.degree.earned} required={map.data.degree.required} />
          </section>
          <Link to="/courses" className={buttonVariants({ className: "w-full" })}>
            <PlusIcon aria-hidden strokeWidth={1.75} />
            Record a grade
          </Link>
          <UnlockedNext map={map.data} animate={animate} />
        </>
      }
    />
  );
}

/**
 * A one-column grid as wide as its container. A bare `grid` gets an `auto` column that grows to its
 * content's intrinsic width, and the tile row's `1fr` tracks size to their unwrapped text, so on a
 * 360px phone the page scrolled sideways.
 */
const column = "grid grid-cols-[minmax(0,1fr)] gap-6";

/**
 * Phone: one column in reading order. From `xl` the header and today's timeline take the center and
 * the tiles, action and unlocked list a 400px right column that starts level with the greeting.
 */
function HomeGrid({
  header,
  main,
  side,
}: {
  header: ReactNode;
  main: ReactNode;
  side?: ReactNode;
}) {
  return (
    <div
      className={cn(
        column,
        "max-w-3xl xl:max-w-none xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-8",
        side && "xl:grid-cols-[minmax(0,1fr)_400px]",
      )}
    >
      <div className="xl:col-start-1 xl:row-start-1">{header}</div>
      <div className={`${column} xl:col-start-1 xl:row-start-2`}>{main}</div>
      {side ? (
        <div className={`${column} xl:col-start-2 xl:row-span-2 xl:row-start-1`}>{side}</div>
      ) : null}
    </div>
  );
}

/** The greeting by Dhaka hour and username, the date in `soft`, and the class pill when one is on. */
function HomeHeader({
  now,
  name,
  routine,
  titles,
}: {
  now: number;
  name?: string;
  routine: RoutineView;
  titles?: ReadonlyMap<string, string>;
}) {
  // Nothing shows until the routine is in, so the header does not shift when it arrives.
  const next = nextClassOf(routine.data, now);
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
      <div className="min-w-0 flex-[1_1_16rem]">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink wrap-anywhere md:text-[32px]">
          {greeting(now, name)}
        </h1>
        <p className="mt-1 text-soft">{dhakaDateLine(now)}</p>
      </div>
      {next ? <NextClassPill entry={next} title={titles?.get(next.courseCode)} now={now} /> : null}
    </header>
  );
}

function UnlockedNext({ map, animate }: { map: CourseMap; animate: boolean }) {
  const { items, total } = unlockedNext(map);
  return (
    <section aria-labelledby="unlocked-title">
      <SectionHeader
        id="unlocked-title"
        title="Unlocked next"
        action={
          total > items.length ? (
            <span className="text-[13px] leading-[1.3] font-medium text-faint tabular-nums">
              Showing {items.length} of {total}
            </span>
          ) : undefined
        }
      />
      <div className={panel}>
        {items.length > 0 ? (
          <>
            <ul className={animate ? "stagger" : undefined}>
              {items.map((slot, index) => {
                // A slot that offers several courses shows every code, one chip each, until one is
                // taken, and its titles wrap instead of cutting the other choices off.
                const label = slotLabel(slot);
                const open = label.hasChoices && !label.chosen;
                return (
                  <li
                    key={slot.code}
                    data-hue={courseHue(label.code.split("/")[0])}
                    style={animate ? staggerRow(index) : undefined}
                    className="flex min-h-[60px] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0"
                  >
                    <StateMark status={slot.status} waived={slot.waived} inCourse />
                    <span
                      className={cn(
                        "flex shrink-0 flex-wrap gap-1",
                        open && "max-w-[40%] justify-start",
                      )}
                    >
                      {label.code.split("/").map((code) => (
                        <CourseCode key={code} code={code} />
                      ))}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[15px] font-medium text-ink",
                        open ? "wrap-anywhere" : "truncate",
                      )}
                    >
                      {label.title}
                    </span>
                    <span className="shrink-0 text-right text-[15px] font-semibold text-soft tabular-nums">
                      {formatCredits(slot.credits)}
                      <span className="text-xs font-normal text-faint"> cr</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/courses"
              className={`flex min-h-12 items-center justify-center border-t border-line px-4 text-[15px] font-semibold text-brand-ink hover:bg-tint ${focusRing}`}
            >
              Open the course map
            </Link>
          </>
        ) : (
          <EmptyState
            icon={CircleCheckIcon}
            title="Nothing is waiting for you."
            description="Record the grades you already have and the courses you can take next will show up here."
          />
        )}
      </div>
    </section>
  );
}

/** The final layout in placeholder bars, so nothing jumps when the data arrives. */
function HomeLoading() {
  return (
    <div aria-busy="true">
      <h1 className="sr-only">Home</h1>
      <HomeGrid
        header={
          <div className="grid gap-2">
            <Skeleton className="h-8 w-64 max-w-full md:h-9" />
            <Skeleton className="h-4 w-40" />
          </div>
        }
        main={
          <div role="status" className={`${panel} grid gap-3 p-4`}>
            <span className="sr-only">Loading your day</span>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-16 rounded-row" />
            <Skeleton className="h-16 rounded-row" />
          </div>
        }
        side={
          <>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((n) => (
                <div
                  key={n}
                  className="flex min-h-[140px] flex-col justify-between rounded-panel bg-surface p-4 md:rounded-[24px]"
                >
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-12 rounded-control" />
            <section>
              <SectionHeader title="Unlocked next" />
              <SkeletonRows rows={UNLOCKED_NEXT_MAX} label="Loading unlocked courses" />
            </section>
          </>
        }
      />
    </div>
  );
}

function Message({
  title,
  as: Heading = "h1",
  children,
}: {
  title: string;
  /** h1 when the message is the page; h2 under the greeting. */
  as?: "h1" | "h2";
  children: ReactNode;
}) {
  return (
    <section className={`${padded} max-w-3xl`}>
      <Heading className="text-lg leading-[1.3] font-semibold text-ink">{title}</Heading>
      <div className="mt-1 grid gap-4 text-soft">{children}</div>
    </section>
  );
}

function SignedOut() {
  return (
    <Message title="Welcome to UniLink">
      <p>
        See how far along your degree is, what you can take next, and swap help with other students.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to="/login" className={buttonVariants({})}>
          Log in
        </Link>
        <Link to="/signup" className={buttonVariants({ variant: "ghost" })}>
          Create an account
        </Link>
      </div>
    </Message>
  );
}

function HomeError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="max-w-3xl">
      <h1 className="sr-only">Home</h1>
      <ErrorBlock
        title="Couldn't load your progress"
        message="Check your connection and try again."
        onRetry={onRetry}
        retrying={retrying}
      />
    </div>
  );
}

function NoCurriculum() {
  return (
    <Message as="h2" title="No course map for your program yet">
      <p>It will show up here once a moderator adds it. Your progress starts counting then.</p>
    </Message>
  );
}
