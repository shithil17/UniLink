import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { MapIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { CategorySection, ExtrasSection } from "@/components/courses/CategorySection";
import { CgpaSummary } from "@/components/courses/CgpaSummary";
import { CategoryJump } from "@/components/courses/CategoryJump";
import { CreditBar } from "@/components/courses/CreditBar";
import { CourseSheet, type SheetTarget } from "@/components/courses/CourseSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { defaultElectiveCategory, formatCredits, overNote } from "@/lib/courseMap";
import { retakeCodes } from "@/lib/attempts";
import { attemptsQuery, courseMapQuery, meQuery } from "@/lib/queries";

export const Route = createFileRoute("/courses")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  // Warm the cache without holding the navigation: a slow or failed load shows its own skeleton or
  // error block in the page, not the root error screen.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(courseMapQuery);
  },
  component: CourseMapPage,
});

/** The flat standing panel, the same surface Home's tiles use. */
const panel = "rounded-panel bg-surface p-4 md:rounded-[24px]";

/**
 * Phone: one column in reading order (title and standing, jump chips, categories, then the CGPA
 * summary). From `xl` the CGPA summary moves to a 360px column that starts level with the title.
 */
function MapGrid({
  header,
  main,
  side,
}: {
  header: ReactNode;
  main?: ReactNode;
  side?: ReactNode;
}) {
  return (
    <div
      className={
        side
          ? "grid max-w-3xl grid-cols-1 gap-6 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-x-8"
          : "grid max-w-3xl grid-cols-1 gap-6"
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:col-start-1 xl:row-start-1">{header}</div>
      {main ? (
        <div className="grid grid-cols-1 gap-6 xl:col-start-1 xl:row-start-2">{main}</div>
      ) : null}
      {side ? (
        <div className="xl:sticky xl:top-22 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {side}
        </div>
      ) : null}
    </div>
  );
}

function MapTitle({ sub }: { sub?: string }) {
  return (
    <div>
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
        Course map
      </h1>
      {sub ? <p className="mt-1 text-soft">{sub}</p> : null}
    </div>
  );
}

function CourseMapPage() {
  const map = useQuery(courseMapQuery);
  const { data: attempts } = useQuery(attemptsQuery);
  const retake = useMemo(() => (attempts ? retakeCodes(attempts) : undefined), [attempts]);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const close = () => setTarget(null);

  if (map.isPending) return <MapLoading />;
  if (!map.data) {
    return (
      <MapGrid
        header={<MapTitle />}
        main={
          <ErrorBlock
            title="Couldn't load your course map"
            message="Check your connection and try again."
            onRetry={() => void map.refetch()}
            retrying={map.isFetching}
          />
        }
      />
    );
  }
  const data = map.data;

  if (!data.curriculum) {
    return (
      <MapGrid
        header={<MapTitle />}
        main={
          <div className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
            <EmptyState
              icon={MapIcon}
              title="No course map for your program yet"
              description="It will show up here once a moderator adds it."
            />
          </div>
        }
      />
    );
  }

  const { curriculum, degree } = data;
  const over = overNote(degree.earned, degree.required);
  const categoryNames = data.categories.map((c) => c.name);
  const electiveCategory = defaultElectiveCategory(data);
  const trailCategory = data.categories.find((c) => c.trails);

  return (
    <>
      <MapGrid
        header={
          <>
            <MapTitle sub={`${curriculum.programName} · ${curriculum.version}`} />
            <section aria-label="Degree standing" className={`${panel} grid gap-3`}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg leading-[1.3] font-semibold text-ink tabular-nums">
                  {formatCredits(degree.earned)} of {formatCredits(degree.required)} credits
                </span>
                {over ? (
                  <span className="text-[13px] leading-[1.3] font-medium text-faint">{over}</span>
                ) : null}
              </p>
              <CreditBar earned={degree.earned} required={degree.required} />
            </section>
            <CategoryJump names={categoryNames} extras />
          </>
        }
        main={
          <>
            {data.categories.map((category) => (
              <CategorySection
                key={category.name}
                category={category}
                retake={retake}
                onOpenSlot={(slot) => setTarget({ type: "slot", slot })}
                onAdd={(name) => setTarget({ type: "add", category: name })}
              />
            ))}
            <ExtrasSection
              extras={data.extras}
              retake={retake}
              onOpen={(course) => setTarget({ type: "extra", course })}
              onAdd={() => setTarget({ type: "add", category: electiveCategory })}
            />
          </>
        }
        side={<CgpaSummary />}
      />
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
    </>
  );
}

/** The final layout in placeholder bars: title, standing panel, chips and two category panels. */
function MapLoading() {
  return (
    <div aria-busy="true">
      <MapGrid
        header={
          <>
            <div>
              <h1 className="sr-only">Course map</h1>
              <Skeleton className="h-8 w-44 md:h-9" />
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
            </div>
            <div className={`${panel} grid gap-3`}>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 rounded-full" />
            </div>
            <div className="flex gap-2 overflow-hidden">
              {[28, 24, 32, 28].map((w, i) => (
                <Skeleton
                  key={i}
                  className="h-10 shrink-0 rounded-full"
                  style={{ width: `${w * 4}px` }}
                />
              ))}
            </div>
          </>
        }
        main={[0, 1].map((i) => (
          <section key={i} className="grid gap-3">
            <Skeleton className="h-6 w-40" />
            <SkeletonRows rows={4} label="Loading your course map" />
          </section>
        ))}
      />
    </div>
  );
}
