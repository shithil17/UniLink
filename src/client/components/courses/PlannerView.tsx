import { useQuery } from "@tanstack/react-query";
import { CalculatorIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { buildPlannerModel, mocksForRows, targetReached } from "@/lib/plannerModel";
import { loadMocks, mocksStorageKey, saveMocks, type MockPicks } from "@/lib/plannerMocks";
import { attemptsQuery, meQuery, targetCgpaQuery } from "@/lib/queries";
import { cgpa } from "../../../shared/grading";
import { adviseRetakes, projectedCgpa } from "../../../shared/planner";
import type { CourseMap } from "../../../shared/schemas/courses";
import { AdvicePanel } from "./AdvicePanel";
import { PlannerSection } from "./PlannerRows";
import { TargetPanel } from "./TargetPanel";

type Parts = { side: ReactNode; main: ReactNode };

/**
 * The Planner view: target and advice up front, then the courses to try mock grades on. Hands its
 * two parts to `children` so the courses screen can place them in its own grid.
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
  // its retakes, so it flows with the page, above the courses.
  const side = <TargetPanel current={current} projected={projected} mockCount={mocks.length} />;

  const main =
    rows.length === 0 ? (
      <>
        <AdvicePanel advice={advice} realReached={targetReached(current, target)} rows={rows} />
        <div className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
          <EmptyState icon={CalculatorIcon} title="Nothing left to plan" />
        </div>
      </>
    ) : (
      <>
        <AdvicePanel advice={advice} realReached={targetReached(current, target)} rows={rows} />
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
        {model.future.length > 0 ? (
          <PlannerSection
            id="planner-future"
            title="Still to take"
            rows={model.future}
            picks={picks}
            onPick={pick}
          />
        ) : null}
        {model.retakes.length > 0 ? (
          <PlannerSection
            id="planner-retakes"
            title="Could retake"
            hint={
              model.lockedCount > 0
                ? `${model.lockedCount} ${model.lockedCount === 1 ? "course" : "courses"} hidden: already B+ or better.`
                : undefined
            }
            rows={model.retakes}
            picks={picks}
            onPick={pick}
          />
        ) : null}
      </>
    );

  return children({ side, main });
}
