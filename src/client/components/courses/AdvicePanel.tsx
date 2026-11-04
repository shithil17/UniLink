import { ArrowRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { courseHue } from "@/lib/courseHue";
import { formatCredits } from "@/lib/courseMap";
import { ESTIMATE_NOTE, historyLine, type PlannerRow } from "@/lib/plannerModel";
import type { CourseStatus } from "../../../shared/schemas/courses";
import type { Advice } from "../../../shared/planner";
import { CourseRowBody } from "./CourseRowBody";

const panel = "rounded-panel bg-surface p-5 md:rounded-[24px]";

function outcomeTitle(advice: Advice, realReached: boolean): string {
  switch (advice.kind) {
    case "reached":
      return realReached ? "Target reached" : "Reached with your mock grades";
    case "too_early":
      return "Too early to call";
    case "no_retakes_needed":
      return "No retakes needed";
    case "retakes_suggested":
      return advice.retakes.length === 1 ? "One retake would help" : "A few retakes would help";
    case "out_of_reach":
      if (advice.tooManyRetakes) return "Too many retakes needed";
      return advice.possible ? "A stretch" : "Out of reach";
  }
}

function neededLabel(needed: number): string {
  if (needed <= 0) return "Any passing grade";
  return needed > 4 ? "over 4.00" : needed.toFixed(2);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="text-soft">{label}</dt>
      <dd className="text-right text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/** One suggested retake as a course row: the course on the left, the grade it moves from and to on the right. */
function RetakeRow({
  retake,
  title,
  status,
}: {
  retake: Extract<Advice, { retakes: unknown }>["retakes"][number];
  title: string;
  status: CourseStatus;
}) {
  return (
    <li
      data-hue={courseHue(retake.code)}
      className="flex min-h-[60px] items-center gap-3 border-t border-line px-5 py-2.5"
    >
      <CourseRowBody
        code={retake.code}
        title={title}
        status={status}
        waived={false}
        meta={
          <span className="shrink-0 text-[13px] leading-[1.3] font-medium text-faint tabular-nums">
            {formatCredits(retake.credits)} cr
          </span>
        }
      />
      <span className="sr-only">
        {retake.currentBest} to {retake.aimFor}
      </span>
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 text-[15px] font-semibold text-ink tabular-nums"
      >
        <span className="text-faint">{retake.currentBest}</span>
        <ArrowRightIcon className="size-3.5 text-faint" strokeWidth={2} />
        {retake.aimFor}
      </span>
    </li>
  );
}

/** The outcome, the predicted finish against what the target needs, the retakes and what the predictions rest on. */
export function AdvicePanel({
  advice,
  realReached,
  rows,
  targetState,
}: {
  /** Null while no target is known: not set, still loading or failed to load. */
  advice: Advice | null;
  /** The real CGPA, not just the projected one, has reached the target. */
  realReached: boolean;
  rows: readonly PlannerRow[];
  /** Whether the saved target is known. Only matters while `advice` is null. */
  targetState: "ready" | "loading" | "failed";
}) {
  if (!advice) {
    return (
      <section aria-labelledby="planner-advice-title" className={panel}>
        <h2 id="planner-advice-title" className="text-base font-semibold text-ink">
          Advice
        </h2>
        {targetState === "loading" ? (
          <div aria-busy="true" className="mt-3 grid gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-soft">
            {targetState === "failed"
              ? "No advice until your target loads."
              : "Set a target CGPA to see what you need."}
          </p>
        )}
        <p className="mt-3 text-[13px] text-faint">{ESTIMATE_NOTE}</p>
      </section>
    );
  }
  const details: { label: string; value: string }[] = [];
  if (advice.kind !== "reached" && advice.kind !== "too_early") {
    if (advice.predictedCgpa !== null) {
      details.push({ label: "Predicted at graduation", value: advice.predictedCgpa.toFixed(2) });
    }
    if (advice.neededAverage !== null && advice.predictedAverage !== null) {
      details.push(
        {
          label: `Needed in your remaining ${formatCredits(advice.remainingCredits)} credits`,
          value: neededLabel(advice.neededAverage),
        },
        { label: "Your usual average there", value: advice.predictedAverage.toFixed(2) },
      );
    }
    if (advice.kind === "out_of_reach") {
      if (advice.bestCaseCgpa !== null) {
        details.push({
          label: "Best case",
          value: advice.bestCaseCgpa.toFixed(2),
        });
      }
      if (advice.maxCgpa !== null) {
        details.push({ label: "Straight A's", value: advice.maxCgpa.toFixed(2) });
      }
    }
  }
  const retakes =
    advice.kind === "retakes_suggested" || advice.kind === "out_of_reach" ? advice.retakes : [];
  return (
    <section aria-labelledby="planner-advice-title" className={panel}>
      <h2 id="planner-advice-title" className="text-base font-semibold text-ink">
        {outcomeTitle(advice, realReached)}
      </h2>
      <p className="mt-2 text-[15px] leading-normal text-soft">{advice.text}</p>
      {details.length > 0 ? (
        <dl className="mt-3 border-t border-line text-sm">
          {details.map((d) => (
            <Detail key={d.label} {...d} />
          ))}
        </dl>
      ) : null}
      {retakes.length > 0 ? (
        <>
          <h3 className="mt-3 border-t border-line pt-3 pb-1 text-sm font-semibold text-ink">
            {advice.kind === "retakes_suggested" ? "Suggested retakes" : "Retakes that help most"}
          </h3>
          <ul className="-mx-5">
            {retakes.map((retake) => {
              const row = rows.find((r) => r.key === retake.code);
              return (
                <RetakeRow
                  key={retake.code}
                  retake={retake}
                  title={row?.title ?? retake.code}
                  status={row?.status ?? "done"}
                />
              );
            })}
          </ul>
        </>
      ) : null}
      <div className="mt-3 grid gap-1 border-t border-line pt-3 text-[13px] leading-[1.35] text-faint">
        <p>{historyLine(advice)}</p>
        <p>{ESTIMATE_NOTE}</p>
      </div>
    </section>
  );
}
