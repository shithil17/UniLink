import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { MonthGrid } from "@/components/routine/MonthGrid";
import { RoutineSheet, type RoutineSheetTarget } from "@/components/routine/RoutineSheet";
import { TimeGrid } from "@/components/routine/TimeGrid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { termLabel } from "@/lib/courseMap";
import { courseMapQuery, meQuery, routineQuery } from "@/lib/queries";
import { routineCourseChoices, titleByCode, useClearRoutine } from "@/lib/routine";
import {
  CALENDAR_VIEWS,
  classesOn,
  periodLabel,
  stepDate,
  type CalendarView,
} from "@/lib/routineCalendar";
import { toast } from "@/lib/toast";
import { useNow } from "@/lib/useNow";
import { useViewFade } from "@/lib/useViewFade";
import { cn } from "@/lib/utils";
import {
  dhakaToday,
  inRange,
  isDateKey,
  monthOf,
  monthWeeks,
  weekOf,
  type DateKey,
} from "../../shared/calendar";
import { currentTerm, termRange } from "../../shared/terms";

type RoutineSearch = { view?: CalendarView; date?: DateKey };

const VIEW_LABELS: Record<CalendarView, string> = { month: "Month", week: "Week", day: "Day" };

export const Route = createFileRoute("/routine")({
  // The view and date live in the URL, so back and forward step through them. Week and today are
  // the defaults and stay out of the URL.
  validateSearch: (search: Record<string, unknown>): RoutineSearch => ({
    view: CALENDAR_VIEWS.find((v) => v !== "week" && v === search.view),
    date: isDateKey(search.date) ? search.date : undefined,
  }),
  // Signed out goes to login. Everyone else, mods and admins included, has their own routine.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (!me) throw redirect({ to: "/login" });
  },
  component: RoutinePage,
});

function RoutinePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const routine = useQuery(routineQuery);
  const map = useQuery(courseMapQuery);
  const now = useNow();
  const [target, setTarget] = useState<RoutineSheetTarget>(null);
  const [clearing, setClearing] = useState(false);

  const view = search.view ?? "week";
  const today = dhakaToday(now);
  const date = search.date ?? today;
  const term = currentTerm(now);
  // ceiling: the routine holds the current term only, and its dates come from the shared term
  // start dates until moderators set each term's real start and end.
  const range = termRange(term);
  const entries = routine.data ?? [];
  const titles = titleByCode(map.data ? routineCourseChoices(map.data) : []);

  const show = (next: { view?: CalendarView; date?: DateKey }) =>
    void navigate({
      search: (prev) => {
        const v = next.view ?? prev.view ?? "week";
        const d = next.date ?? prev.date ?? today;
        return { view: v === "week" ? undefined : v, date: d === today ? undefined : d };
      },
    });
  const openDay = (d: DateKey) => show({ view: "day", date: d });

  // The grid below is drawn from `shown`, which trails `view` by one 110ms fade-out.
  const { shown, fading } = useViewFade(view);
  const empty =
    shown === "day" && !inRange(date, range)
      ? {
          title: "No classes this day.",
          description: `This day is outside ${termLabel(term)}.`,
        }
      : routine.data && entries.length === 0
        ? {
            title: "No classes yet.",
            description: "Add the ones you're taking this term, or tap an empty slot on the grid.",
          }
        : shown === "day" && routine.data && classesOn(entries, date, range).length === 0
          ? { title: date === today ? "No classes today." : "No classes this day." }
          : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex min-h-11 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
            Routine
          </h1>
          <p className="mt-1 text-soft">{termLabel(term)}</p>
        </div>
        <Button size="sm" disabled={!routine.data} onClick={() => setTarget("new")}>
          <PlusIcon aria-hidden />
          Add class
        </Button>
      </header>

      <Tabs value={view} onValueChange={(v) => show({ view: v as CalendarView })}>
        <TabsList aria-label="Calendar view" className="w-full md:w-80">
          {CALENDAR_VIEWS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {VIEW_LABELS[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg leading-[1.3] font-semibold text-ink" aria-live="polite">
          {periodLabel(view, date)}
        </h2>
        <div className="-mr-2.5 flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={date === today}
            onClick={() => show({ date: today })}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={`Previous ${view}`}
            onClick={() => show({ date: stepDate(view, date, -1) })}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={`Next ${view}`}
            onClick={() => show({ date: stepDate(view, date, 1) })}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {routine.isPending ? (
        <div
          aria-busy="true"
          role="status"
          aria-label="Loading your routine"
          className="grid gap-3 rounded-panel bg-surface p-4 md:rounded-[24px]"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : routine.isError ? (
        <ErrorBlock
          title="Your routine didn't load"
          message={errorMessage(routine.error)}
          onRetry={() => void routine.refetch()}
          retrying={routine.isFetching}
        />
      ) : (
        <div
          data-fading={fading || undefined}
          className={cn(
            "flex flex-col gap-4 motion-safe:transition-opacity motion-safe:duration-110 motion-safe:ease-ui-out",
            fading && "pointer-events-none opacity-0",
          )}
        >
          {empty ? (
            <div className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
              <EmptyState icon={CalendarIcon} {...empty} />
            </div>
          ) : null}
          {shown === "month" ? (
            <MonthGrid
              weeks={monthWeeks(date)}
              month={monthOf(date)}
              entries={entries}
              term={range}
              today={today}
              now={now}
              onPickDate={openDay}
            />
          ) : (
            <TimeGrid
              dates={shown === "week" ? weekOf(date) : [date]}
              entries={entries}
              term={range}
              today={today}
              now={now}
              titles={titles}
              onOpen={setTarget}
              onAdd={setTarget}
              onPickDate={shown === "week" ? openDay : undefined}
            />
          )}
        </div>
      )}

      {entries.length > 0 ? (
        <div className="pt-2">
          <Button variant="outline" onClick={() => setClearing(true)}>
            Clear this term
          </Button>
        </div>
      ) : null}

      <p className="text-[13px] leading-[1.3] font-medium text-faint">
        Times are Dhaka time. Only you can see your routine.
      </p>

      <RoutineSheet
        target={target}
        entries={entries}
        choices={map.data ? routineCourseChoices(map.data) : []}
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
