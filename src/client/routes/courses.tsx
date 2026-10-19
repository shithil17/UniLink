import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CategorySection, ExtrasSection } from "@/components/courses/CategorySection";
import { CourseSheet, type SheetTarget } from "@/components/courses/CourseSheet";
import {
  categoryAnchor,
  defaultElectiveCategory,
  formatTotals,
  overNote,
  progressPercent,
} from "@/lib/courseMap";
import { courseMapQuery, meQuery } from "@/lib/queries";

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
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const close = () => setTarget(null);

  if (!map.curriculum) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Course map</h1>
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
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

  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <aside className="mb-6 space-y-4 lg:sticky lg:top-22 lg:mb-0">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{curriculum.programName}</h1>
          <p className="text-sm text-soft">Course map {curriculum.version}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-soft">Degree credits</p>
          <p className="text-3xl font-semibold text-ink">
            {formatTotals(degree.earned, degree.required)}
          </p>
          {over ? <p className="text-sm text-faint">{over}</p> : null}
          <ProgressBar earned={degree.earned} required={degree.required} />
        </div>
        <nav aria-label="Categories" className="hidden lg:block">
          <ul className="space-y-1">
            {map.categories.map((c) => (
              <li key={c.name}>
                <a
                  href={`#${categoryAnchor(c.name)}`}
                  className="block rounded-lg px-3 py-2 hover:bg-tint focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{c.name}</span>
                    <span className="shrink-0 text-soft">{formatTotals(c.earned, c.required)}</span>
                  </span>
                  <ProgressBar earned={c.earned} required={c.required} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="xl:columns-2 xl:gap-6">
        {map.categories.map((category) => (
          <CategorySection
            key={category.name}
            category={category}
            onOpenSlot={(slot) => setTarget({ type: "slot", slot })}
            onAdd={(name) => setTarget({ type: "add", category: name })}
          />
        ))}
        <ExtrasSection
          extras={map.extras}
          onOpen={(course) => setTarget({ type: "extra", course })}
          onAdd={() => setTarget({ type: "add", category: electiveCategory })}
        />
      </div>
      <CourseSheet target={target} categories={categoryNames} onClose={close} />
    </div>
  );
}

/** Earned against required; full once the total is reached, even when over it. */
function ProgressBar({ earned, required }: { earned: number; required: number }) {
  const percent = progressPercent(earned, required);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Credits earned"
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint"
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
    </div>
  );
}
