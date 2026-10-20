import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { categoriesLeft, formatCgpa } from "@/lib/attempts";
import { formatCredits, formatTotals } from "@/lib/courseMap";
import { cgpaSummaryQuery } from "@/lib/queries";
import type { CgpaSummary as Summary } from "../../../shared/schemas/attempts";

const panel = "rounded-panel border border-line bg-surface p-5";

/** The summary itself, apart from its query so it can be shown for any value. */
export function CgpaSummaryView({ summary }: { summary: Summary }) {
  const left = categoriesLeft(summary);
  return (
    <section className={panel} aria-labelledby="cgpa-title">
      <h2 id="cgpa-title" className="text-base font-semibold text-ink">
        CGPA
      </h2>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span
          className="text-4xl font-semibold text-ink tabular-nums"
          aria-label={summary.cgpa === null ? "No CGPA yet" : undefined}
        >
          {formatCgpa(summary.cgpa)}
        </span>
        {summary.cgpa === null ? null : (
          <span className="text-sm text-soft tabular-nums">
            over {formatCredits(summary.gradedCredits)} graded credits
          </span>
        )}
      </p>
      {summary.cgpa === null ? (
        <p className="mt-1 text-sm text-soft">
          Record a graded course and your CGPA shows up here. Waived, incomplete and withdrawn
          courses don't count.
        </p>
      ) : null}
      <dl className="mt-4 border-t border-line text-sm">
        <div className="flex justify-between gap-3 border-b border-line py-2">
          <dt className="text-soft">Earned</dt>
          <dd className="text-ink tabular-nums">
            {formatTotals(summary.earnedCredits, summary.requiredCredits)} credits
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-soft">Remaining</dt>
          <dd className="text-ink tabular-nums">
            {formatCredits(summary.remainingCredits)} credits
          </dd>
        </div>
      </dl>
      <h3 className="border-t border-line pt-3 text-sm font-semibold text-ink">
        Credits left by category
      </h3>
      {left.length === 0 ? (
        <p className="mt-1 text-sm text-soft">Every category has its credits.</p>
      ) : (
        <ul className="mt-1 text-sm">
          {left.map((c) => (
            <li
              key={c.name}
              className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0"
            >
              <span className="truncate text-ink">{c.name}</span>
              <span className="shrink-0 text-soft tabular-nums">{formatCredits(c.remaining)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The CGPA panel on the courses screen. A failed load never blocks the map beside it. */
export function CgpaSummary() {
  const { data, isPending, isError, refetch } = useQuery(cgpaSummaryQuery);
  if (data) return <CgpaSummaryView summary={data} />;
  return (
    <section className={panel} aria-labelledby="cgpa-title">
      <h2 id="cgpa-title" className="text-base font-semibold text-ink">
        CGPA
      </h2>
      {isPending ? (
        <p className="mt-2 text-sm text-soft">Loading...</p>
      ) : isError ? (
        <div className="mt-2 space-y-2">
          <p role="alert" className="text-sm text-soft">
            Your CGPA did not load.
          </p>
          <Button variant="outline" size="lg" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
    </section>
  );
}
