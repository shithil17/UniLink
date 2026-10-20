import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategorySection, ExtrasSection } from "@/components/courses/CategorySection";
import { CgpaSummary } from "@/components/courses/CgpaSummary";
import { CreditBar } from "@/components/courses/CreditBar";
import { CourseSheet, type SheetTarget } from "@/components/courses/CourseSheet";
import {
  categoryAnchor,
  defaultElectiveCategory,
  formatCredits,
  formatTotals,
  isNonCreditCategory,
  overNote,
} from "@/lib/courseMap";
import { focusRing } from "@/components/ui/focus";
import { retakeCodes } from "@/lib/attempts";
import { attemptsQuery, courseMapQuery, meQuery } from "@/lib/queries";

export const Route = createFileRoute("/courses")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  // A thrown error (offline included) lands on the root error screen.
  loader: ({ context }) => context.queryClient.ensureQueryData(courseMapQuery),
  component: CourseMapPage,
});

function CourseMapPage() {
  const { data: map } = useSuspenseQuery(courseMapQuery);
  const { data: attempts } = useQuery(attemptsQuery);
  const retake = useMemo(() => (attempts ? retakeCodes(attempts) : undefined), [attempts]);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const close = () => setTarget(null);

  if (!map.curriculum) {
    return (
      <section className="space-y-2">
        <h1 className="text-base font-semibold text-ink">Course map</h1>
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">No course map for your program yet</p>
          <p className="mt-1 text-sm text-soft">It will show up here once a moderator adds it.</p>
        </div>
      </section>
    );
  }

  const { curriculum, degree } = map;
  const over = overNote(degree.earned, degree.required);
  const categoryNames = map.categories.map((c) => c.name);
  const electiveCategory = defaultElectiveCategory(map);
  const trailCategory = map.categories.find((c) => c.trails);

  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <aside className="mb-6 lg:sticky lg:top-22 lg:mb-0">
        <section
          className="rounded-panel border border-line bg-surface p-5"
          aria-labelledby="standing-title"
        >
          <h1 id="standing-title" className="text-base font-semibold text-ink">
            {curriculum.programName}
          </h1>
          <p className="text-sm text-soft">Course map {curriculum.version}</p>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
            <span className="text-4xl font-semibold text-ink tabular-nums">
              {formatCredits(degree.earned)}
            </span>
            <span className="text-sm text-soft tabular-nums">
              of {formatCredits(degree.required)} credits{over ? `, ${over}` : ""}
            </span>
          </p>
          <CreditBar earned={degree.earned} required={degree.required} className="mt-3" />
          <nav aria-label="Categories" className="mt-4 border-t border-line pt-2">
            <ul>
              {map.categories.map((c) => (
                <li key={c.name}>
                  <a
                    href={`#${categoryAnchor(c.name)}`}
                    className={`-mx-2 block rounded-control px-2 py-2 hover:bg-tint ${focusRing}`}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{c.name}</span>
                      <span className="shrink-0 text-soft tabular-nums">
                        {isNonCreditCategory(c) ? "Non-credit" : formatTotals(c.earned, c.required)}
                      </span>
                    </span>
                    {isNonCreditCategory(c) ? null : (
                      <CreditBar
                        earned={c.earned}
                        required={c.required}
                        label={`${c.name} credits earned`}
                        className="mt-1.5"
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>
        <div className="mt-4">
          <CgpaSummary />
        </div>
      </aside>
      <div className="xl:columns-2 xl:gap-6">
        {map.categories.map((category) => (
          <CategorySection
            key={category.name}
            category={category}
            retake={retake}
            onOpenSlot={(slot) => setTarget({ type: "slot", slot })}
            onAdd={(name) => setTarget({ type: "add", category: name })}
          />
        ))}
        <ExtrasSection
          extras={map.extras}
          retake={retake}
          onOpen={(course) => setTarget({ type: "extra", course })}
          onAdd={() => setTarget({ type: "add", category: electiveCategory })}
        />
      </div>
      <CourseSheet
        target={target}
        categories={categoryNames}
        trailCategory={
          trailCategory?.trails
            ? { name: trailCategory.name, trails: trailCategory.trails }
            : undefined
        }
        onClose={close}
      />
    </div>
  );
}
