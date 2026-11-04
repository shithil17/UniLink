import { useQuery } from "@tanstack/react-query";
import { CalculatorIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildPlannerModel, mocksForRows, targetReached } from "@/lib/plannerModel";
import { loadMocks, mocksStorageKey, saveMocks, type MockPicks } from "@/lib/plannerMocks";
import { attemptsQuery, meQuery, targetCgpaQuery } from "@/lib/queries";
import { cgpa } from "../../../shared/grading";
import { adviseRetakes, DEFAULT_RULES, projectedCgpa } from "../../../shared/planner";
import type { CourseMap } from "../../../shared/schemas/courses";
import { AdvicePanel } from "./AdvicePanel";
import { PlannerList } from "./PlannerRows";
import { TargetPanel } from "./TargetPanel";

type Parts = { side: ReactNode; main: ReactNode };
type PlannerTab = "advice" | "retakes" | "upcoming";

function TabCount({ count }: { count: number }) {
  return <span className="font-medium tabular-nums">{count}</span>;
}

/**
 * The Planner view: the target up front, then one of advice, retakes or upcoming courses. Tabs keep
 * the retakes in the first screen instead of under every remaining course. Hands its two parts to
 * `children` so the courses screen can place them in its own grid.
 */
export function PlannerView({
  map,
  children,
}: {
  map: CourseMap;
  children: (parts: Parts) => ReactNode;
}) {
  const me = useQuery(meQuery);
  const attempts = useQuery(attemptsQuery);
  if (attempts.isPending) {
    return children({
      side: (
        // Bars on a surface panel: a bare `track` block would sit almost flat on the page.
        <div aria-busy="true" className="grid gap-3 rounded-panel bg-surface p-5 md:rounded-[24px]">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-12" />
        </div>
      ),
      main: <SkeletonRows rows={4} label="Loading your planner" />,
    });
  }
  if (!attempts.data) {
    return children({
      side: null,
      main: (
        <ErrorBlock
          title="Couldn't load your grades"
          message="The planner needs them. Check your connection and try again."
          onRetry={() => void attempts.refetch()}
          retrying={attempts.isFetching}
        />
      ),
    });
  }
  const version = map.curriculum?.version ?? "";
  const storageKey = mocksStorageKey(me.data?.username ?? "", version);
  // Re-keyed so another user or curriculum on this device starts from its own saved picks.
  return (
    <PlannerBody key={storageKey} map={map} attempts={attempts.data} storageKey={storageKey}>
      {children}
    </PlannerBody>
  );
}

function PlannerBody({
  map,
  attempts,
  storageKey,
  children,
}: {
  map: CourseMap;
  attempts: readonly { courseCode: string; grade: string }[];
  storageKey: string;
  children: (parts: Parts) => ReactNode;
}) {
  const [picks, setPicks] = useState<MockPicks>(() => loadMocks(storageKey));
  const [tab, setTab] = useState<PlannerTab>("advice");
  const target = useQuery(targetCgpaQuery).data?.targetCgpa ?? null;
  const model = useMemo(() => buildPlannerModel(map, attempts), [map, attempts]);
  const rows = useMemo(() => [...model.future, ...model.retakes], [model]);
  const mocks = useMemo(() => mocksForRows(rows, picks), [rows, picks]);
  const current = useMemo(() => cgpa(model.records), [model]);
  const projected = useMemo(() => projectedCgpa(model.records, mocks), [model, mocks]);
  const advice = useMemo(
    () => (target === null ? null : adviseRetakes(model.records, mocks, model.remaining, target)),
    [model, mocks, target],
  );

  const pick = (key: string, grade: string | null) =>
    setPicks((previous) => {
      const next = { ...previous };
      if (grade === null) delete next[key];
      else next[key] = grade;
      saveMocks(storageKey, next);
      return next;
    });
  const clear = () => {
    saveMocks(storageKey, {});
    setPicks({});
  };

  // Only the compact CGPA and target block is the (sticky) side column. The advice can grow with
  // its retakes, so it flows with the page.
  const side = <TargetPanel current={current} projected={projected} mockCount={mocks.length} />;
  const advicePanel = (
    <AdvicePanel advice={advice} realReached={targetReached(current, target)} rows={rows} />
  );
  const mockBar = (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="min-w-0 flex-1 basis-48 text-sm text-soft">
        Try a grade on any course. Mocks stay on this device.
      </p>
      {mocks.length > 0 ? (
        <Button variant="outline" size="sm" onClick={clear}>
          Clear mock grades
        </Button>
      ) : null}
    </div>
  );
  // A list that has emptied since the tab was picked falls back to the advice.
  const listEmpty =
    (tab === "retakes" && model.retakes.length === 0) ||
    (tab === "upcoming" && model.future.length === 0);

  const main =
    rows.length === 0 ? (
      <>
        {advicePanel}
        <div className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
          <EmptyState icon={CalculatorIcon} title="Nothing left to plan" />
        </div>
      </>
    ) : (
      <Tabs
        value={listEmpty ? "advice" : tab}
        onValueChange={(value) => setTab(value as PlannerTab)}
        className="min-w-0 gap-4"
      >
        <TabsList aria-label="Planner" className="w-full">
          <TabsTrigger value="advice" className="px-2!">
            Advice
          </TabsTrigger>
          {model.retakes.length > 0 ? (
            <TabsTrigger value="retakes" className="px-2!">
              Retakes <TabCount count={model.retakes.length} />
            </TabsTrigger>
          ) : null}
          {model.future.length > 0 ? (
            <TabsTrigger value="upcoming" className="px-2!">
              Upcoming <TabCount count={model.future.length} />
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="advice">{advicePanel}</TabsContent>
        <TabsContent value="retakes" className="grid gap-3">
          {mockBar}
          <PlannerList
            hint={
              model.lockedCount > 0
                ? `${model.lockedCount} ${model.lockedCount === 1 ? "course" : "courses"} hidden: already ${DEFAULT_RULES.policy.blockedFrom} or better.`
                : undefined
            }
            rows={model.retakes}
            picks={picks}
            onPick={pick}
          />
        </TabsContent>
        <TabsContent value="upcoming" className="grid gap-3">
          {mockBar}
          <PlannerList rows={model.future} picks={picks} onPick={pick} />
        </TabsContent>
      </Tabs>
    );

  return children({ side, main });
}
