import { courseHue } from "@/lib/courseHue";
import { formatCredits } from "@/lib/courseMap";
import { ESTIMATE_NOTE, historyLine, type PlannerRow } from "@/lib/plannerModel";
import type { Advice } from "../../../shared/planner";
import { CourseCode } from "./CourseCode";

const panel = "rounded-panel bg-surface p-5 md:rounded-[24px]";

function outcomeTitle(advice: Advice, realReached: boolean): string {
  switch (advice.kind) {
    case "reached":
      return realReached ? "Target reached" : "Reached with your mock grades";
    case "no_retakes_needed":
      return "No retakes needed";
    case "retakes_suggested":
      return advice.retakes.length === 1 ? "One retake would help" : "A few retakes would help";
    case "out_of_reach":
      if (advice.tooManyRetakes) return "Too many retakes needed";
      return advice.bestCaseCgpa !== null && advice.bestCaseCgpa >= advice.target
        ? "A stretch at your usual grades"
        : "Out of reach by graduation";
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="text-soft">{label}</dt>
      <dd className="text-right text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/** The outcome, the predicted finish against what the target needs, the retakes and what the predictions rest on. */
export function AdvicePanel({
  advice,
  realReached,
  rows,
}: {
  /** Null while no target is set. */
  advice: Advice | null;
  /** The real CGPA, not just the projected one, has reached the target. */
  realReached: boolean;
  rows: readonly PlannerRow[];
}) {
  if (!advice) {
    return (
      <section aria-labelledby="planner-advice-title" className={panel}>
        <h2 id="planner-advice-title" className="text-base font-semibold text-ink">
          Advice
        </h2>
        <p className="mt-2 text-sm text-soft">
          Set a target CGPA and you will see the average you need in your remaining courses, and any
          retakes worth paying for.
        </p>
        <p className="mt-3 text-[13px] text-faint">{ESTIMATE_NOTE}</p>
      </section>
    );
  }
  const details: { label: string; value: string }[] = [];
  if (advice.kind !== "reached") {
    if (advice.predictedCgpa !== null) {
      details.push({ label: "Predicted at graduation", value: advice.predictedCgpa.toFixed(2) });
    }
    if (advice.neededAverage !== null && advice.predictedAverage !== null) {
      details.push(
        {
          label: `Needed in your remaining ${formatCredits(advice.remainingCredits)} credits`,
          value: advice.neededAverage > 4 ? "over 4.00" : advice.neededAverage.toFixed(2),
        },
        { label: "Your usual average there", value: advice.predictedAverage.toFixed(2) },
      );
    }
  }
  const retakes =
    advice.kind === "retakes_suggested" || advice.kind === "out_of_reach" ? advice.retakes : [];
  const titleOf = (code: string) => rows.find((r) => r.key === code)?.title;
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
          <h3 className="border-t border-line pt-3 text-sm font-semibold text-ink">
            {advice.kind === "retakes_suggested" ? "Suggested retakes" : "Retakes that help most"}
          </h3>
          <ul className="mt-1 text-sm">
            {retakes.map((retake) => (
              <li
                key={retake.code}
                data-hue={courseHue(retake.code)}
                className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <CourseCode code={retake.code} />
                  {titleOf(retake.code) ? (
                    <p className="mt-1 truncate text-[13px] text-soft">{titleOf(retake.code)}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-ink tabular-nums">
                  {retake.currentBest} to {retake.aimFor}
                </span>
                <span className="w-12 shrink-0 text-right text-soft tabular-nums">
                  {formatCredits(retake.credits)} cr
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-3 border-t border-line pt-3 text-sm text-soft">{historyLine(advice)}</p>
      <p className="mt-2 text-[13px] text-faint">{ESTIMATE_NOTE}</p>
    </section>
  );
}
