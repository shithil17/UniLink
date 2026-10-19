import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CategorySection, ExtrasSection } from "@/components/courses/CategorySection";
import { CourseSheet, type SheetTarget } from "@/components/courses/CourseSheet";
import { defaultElectiveCategory, formatTotals, overNote } from "@/lib/courseMap";
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
    <section className="space-y-6">
      <header className="space-y-3">
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
        </div>
      </header>
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
      <CourseSheet target={target} categories={categoryNames} onClose={close} />
    </section>
  );
}
