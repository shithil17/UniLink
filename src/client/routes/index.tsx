import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CreditBar } from "@/components/courses/CreditBar";
import { StateMark } from "@/components/courses/StateMark";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";
import { formatCredits, overNote } from "@/lib/courseMap";
import { selectHomeState, unlockedNext, UNLOCKED_NEXT_MAX } from "@/lib/home";
import { courseMapQuery, meQuery } from "@/lib/queries";
import type { CourseMap } from "../../shared/schemas/courses";
import { slotLabel } from "../../shared/slotChoice";

export const Route = createFileRoute("/")({
  component: Home,
});

const panel = "rounded-panel border border-line bg-surface p-5";
/** A flat placeholder for loading: the final layout, no shimmer. */
const flat = "rounded-control bg-tint";

function Home() {
  const me = useQuery(meQuery);
  const map = useQuery({ ...courseMapQuery, enabled: me.data != null });
  const state = selectHomeState(me, map);

  const retry = () => {
    void (me.isError ? me.refetch() : map.refetch());
  };

  return (
    <div className="max-w-3xl space-y-8">
      {state === "loading" ? <HomeLoading /> : null}
      {state === "signedOut" ? <SignedOut /> : null}
      {state === "error" ? <HomeError onRetry={retry} /> : null}
      {state === "empty" ? <NoCurriculum /> : null}
      {state === "ready" && map.data ? <HomeReady map={map.data} /> : null}
    </div>
  );
}

function HomeReady({ map }: { map: CourseMap }) {
  const { curriculum, degree } = map;
  const over = overNote(degree.earned, degree.required);
  const { items, total } = unlockedNext(map);

  return (
    <>
      <section className={panel} aria-labelledby="standing-title">
        <h1 id="standing-title" className="text-sm text-soft">
          {curriculum?.programName}
        </h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-4xl font-semibold text-ink tabular-nums">
            {formatCredits(degree.earned)}
          </span>
          <span className="text-sm text-soft tabular-nums">
            of {formatCredits(degree.required)} credits{over ? `, ${over}` : ""}
          </span>
        </p>
        <CreditBar earned={degree.earned} required={degree.required} className="mt-4" />
        <Link
          to="/courses"
          className={buttonVariants({ size: "lg", className: "mt-5 w-full md:w-auto" })}
        >
          Record a grade
        </Link>
      </section>

      <section aria-label="Unlocked next">
        <SectionHeader
          title="Unlocked next"
          count={total}
          action={
            <Link
              to="/courses"
              className={`rounded-control text-brand underline-offset-4 hover:underline ${focusRing}`}
            >
              Course map
            </Link>
          }
        />
        {items.length > 0 ? (
          <ul>
            {items.map((slot) => {
              // A slot that offers several courses shows all their codes until one is taken, and
              // its titles wrap instead of cutting the other choices off.
              const label = slotLabel(slot);
              const open = label.hasChoices && !label.chosen;
              return (
                <li
                  key={slot.code}
                  className="flex items-center gap-3 border-b border-line py-3 text-sm"
                >
                  <StateMark status={slot.status} waived={slot.waived} />
                  <span
                    className={`min-w-[4.5rem] shrink-0 font-medium text-ink ${open ? "max-w-[40%] wrap-anywhere" : ""}`}
                  >
                    {label.code}
                  </span>
                  <span className={`min-w-0 flex-1 text-soft ${open ? "" : "truncate"}`}>
                    {label.title}
                  </span>
                  <span className="shrink-0 text-right text-soft tabular-nums">
                    {formatCredits(slot.credits)} cr
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-sm text-soft">
            Nothing unlocked yet. Record the grades you already have and the courses you can take
            next will show up here.
          </p>
        )}
        {total > items.length ? (
          <p className="pt-3 text-sm text-soft">
            {total - items.length} more in the{" "}
            <Link
              to="/courses"
              className={`rounded-control text-brand underline underline-offset-4 ${focusRing}`}
            >
              course map
            </Link>
            .
          </p>
        ) : null}
      </section>
    </>
  );
}

function HomeLoading() {
  return (
    <div aria-busy="true">
      <h1 className="sr-only">Home</h1>
      <p role="status" className="sr-only">
        Loading your progress
      </p>
      <section className={panel}>
        <div className={`h-5 w-48 ${flat}`} />
        <div className={`mt-2 h-10 w-36 ${flat}`} />
        <div className="mt-4 h-1 rounded-full bg-tint" />
        <div className={`mt-5 h-11 w-full md:w-40 ${flat}`} />
      </section>
      <div className="mt-8">
        <SectionHeader title="Unlocked next" />
        <ul>
          {Array.from({ length: UNLOCKED_NEXT_MAX }, (_, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-line py-3">
              <div className="size-4 shrink-0 rounded-full bg-tint" />
              <div className={`h-5 w-16 ${flat}`} />
              <div className={`h-5 flex-1 ${flat}`} />
              <div className={`h-5 w-10 ${flat}`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panel}>
      <h1 className="text-base font-semibold text-ink">{title}</h1>
      <div className="mt-1 space-y-4 text-sm text-soft">{children}</div>
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
        <Link to="/login" className={buttonVariants({ size: "lg" })}>
          Log in
        </Link>
        <Link
          to="/signup"
          className={`rounded-control text-brand underline underline-offset-4 ${focusRing}`}
        >
          Create an account
        </Link>
      </div>
    </Message>
  );
}

function HomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <Message title="Couldn't load your progress">
      <p>Check your connection and try again.</p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </Message>
  );
}

function NoCurriculum() {
  return (
    <Message title="No course map for your program yet">
      <p>It will show up here once a moderator adds it. Your progress starts counting then.</p>
    </Message>
  );
}
