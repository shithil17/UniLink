import { useQuery } from "@tanstack/react-query";
import { Caption, Figure, Tile } from "@/components/home/Tile";
import { CreditBar } from "@/components/courses/CreditBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { categoriesLeft, formatCgpa } from "@/lib/attempts";
import { formatCredits, formatTotals } from "@/lib/courseMap";
import { cgpaSummaryQuery } from "@/lib/queries";
import type { CgpaSummary as Summary } from "../../../shared/schemas/attempts";

const panel = "rounded-panel bg-surface p-5 md:rounded-[24px]";

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

/**
 * The CGPA tile on Home: the figure on `brand-soft`, with what it is based on underneath. Pending
 * and failed loads stay inside the tile, so they never block the rest of Home. No grade yet prints
 * a dash and says what to do, never a made-up number.
 */
export function CgpaTile({
  summary,
  isError = false,
  onRetry,
}: {
  /** Leave it out while the summary loads (or after it failed, with `isError`). */
  summary?: Summary;
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (!summary) {
    return (
      <Tile tone="accent" aria-busy={!isError}>
        <Caption>CGPA</Caption>
        {!isError ? (
          <>
            <span role="status" className="sr-only">
              Loading your CGPA
            </span>
            <Skeleton className="h-10 w-24 bg-brand-ink/15" />
            <Skeleton className="h-4 w-32 bg-brand-ink/15" />
          </>
        ) : (
          <>
            <Figure aria-label="No CGPA yet">–</Figure>
            <div className="grid justify-items-start gap-2">
              <Caption role="alert">Your CGPA did not load.</Caption>
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Tile>
    );
  }
  const none = summary.cgpa === null;
  return (
    <Tile tone="accent">
      <Caption>CGPA</Caption>
      <Figure aria-label={none ? "No CGPA yet" : undefined}>{formatCgpa(summary.cgpa)}</Figure>
      <Caption>
        {none
          ? "Record a graded course"
          : `over ${formatCredits(summary.gradedCredits)} graded credits`}
      </Caption>
    </Tile>
  );
}

/** The credits tile on Home: earned of required, the 14px bar and what is left. */
export function CreditsTile({ earned, required }: { earned: number; required: number }) {
  const left = Math.max(0, required - earned);
  return (
    <Tile tone="plain">
      <Caption className="text-soft">Credits done</Caption>
      <Figure>
        {formatCredits(earned)}{" "}
        <small className="text-[15px] leading-none font-medium tracking-normal text-faint">
          of {formatCredits(required)}
        </small>
      </Figure>
      <div>
        <CreditBar earned={earned} required={required} />
        <Caption className="mt-2 text-soft">
          {left > 0 ? `${formatCredits(left)} to go` : "All credits done"}
        </Caption>
      </div>
    </Tile>
  );
}
