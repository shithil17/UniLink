import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { CourseCode } from "@/components/courses/CourseCode";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { CourseEditSheet, type CourseSheetTarget } from "@/components/mod/CourseEditSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import { press } from "@/components/ui/press";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { formatCredits } from "@/lib/courseMap";
import {
  groupByCategory,
  matchesCourse,
  modCoursesQuery,
  modCurriculaQuery,
} from "@/lib/modCourses";
import { slotLabel } from "../../shared/slotChoice";
import type { ModCourse, ModCurriculum } from "../../shared/schemas/modCourses";
import { modPanel as panel, modTitle } from "@/components/mod/modStyles";

export const Route = createFileRoute("/mod/courses")({
  component: CoursesPage,
});

/** The loading row in the final layout: a title over a code chip, and a short credits figure. */
const skeletonRow = (
  <>
    <div className="grid min-w-0 flex-1 gap-1.5">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-16 rounded-full" />
    </div>
    <Skeleton className="h-4 w-10 shrink-0" />
  </>
);

const curriculumLabel = (c: ModCurriculum) => `${c.programCode} ${c.programName} · ${c.version}`;

function CoursesPage() {
  const curricula = useQuery(modCurriculaQuery);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const list = curricula.data ?? [];
  const curriculum = list.find((c) => c.id === pickedId) ?? list[0] ?? null;

  return (
    <section className="space-y-5">
      <h1 className={modTitle}>Courses</h1>
      {curricula.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading curricula">
          <Skeleton className="h-12 rounded-control" />
        </div>
      ) : curricula.isError ? (
        <ErrorBlock
          title="The curricula didn't load"
          message={errorMessage(curricula.error)}
          onRetry={() => void curricula.refetch()}
          retrying={curricula.isRefetching}
        />
      ) : curriculum === null ? (
        <div className={panel}>
          <EmptyState
            icon={BookOpenIcon}
            title="No curricula yet"
            description="Import a curriculum first, then edit it here."
          />
        </div>
      ) : (
        <>
          <OptionSelect
            id="mod-courses-curriculum"
            value={String(curriculum.id)}
            onChange={(v) => setPickedId(Number(v))}
            options={list.map((c) => ({ value: String(c.id), label: curriculumLabel(c) }))}
          />
          <CurriculumCourses key={curriculum.id} curriculum={curriculum} />
        </>
      )}
    </section>
  );
}

function CurriculumCourses({ curriculum }: { curriculum: ModCurriculum }) {
  const list = useQuery(modCoursesQuery(curriculum.id));
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [target, setTarget] = useState<CourseSheetTarget>(null);
  const [newIn, setNewIn] = useState<string | null>(null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const hiddenCount = all.filter((c) => c.hidden).length;
  const groups = useMemo(
    () => groupByCategory(all.filter((c) => (showHidden || !c.hidden) && matchesCourse(c, query))),
    [all, query, showHidden],
  );
  const shown = groups.reduce((n, g) => n + g.courses.length, 0);

  const openNew = (category: string | null) => {
    setNewIn(category);
    setTarget("new");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-[1.3] font-medium text-soft">
          Effective from admission year{" "}
          <span className="tabular-nums">{curriculum.effectiveFromYear}</span>
        </p>
        <Button className="shrink-0" onClick={() => openNew(null)}>
          <PlusIcon data-icon="inline-start" />
          Add course
        </Button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
          />
          <Input
            id="mod-courses-search"
            type="search"
            className="pl-10"
            placeholder="Search by code or title"
            aria-label="Search by code or title"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Chip pressed={showHidden} onPressedChange={setShowHidden}>
          Show hidden
          {hiddenCount > 0 ? (
            <span className="text-faint tabular-nums">({hiddenCount})</span>
          ) : null}
        </Chip>
      </div>

      {list.isPending ? (
        <SkeletonRows rows={4} row={skeletonRow} label="Loading courses" />
      ) : list.isError ? (
        <ErrorBlock
          title="The courses didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : shown === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={BookOpenIcon}
            title="No courses found"
            description={
              query || showHidden
                ? "No course matches that search."
                : "This curriculum has no courses yet."
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.name} aria-label={group.name}>
            <SectionHeader
              title={group.name}
              count={group.courses.length}
              action={
                <Button variant="ghost" size="sm" onClick={() => openNew(group.name)}>
                  Add here
                </Button>
              }
            />
            <ul className={panel}>
              {group.courses.map((course) => (
                <li key={course.id} className="border-t border-line first:border-t-0">
                  <CourseRow course={course} onOpen={() => setTarget(course)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <CourseEditSheet
        target={target}
        curriculumId={curriculum.id}
        courses={all}
        defaultCategory={newIn}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

/** The credits cell: 15/600 `soft` with a 12px `faint` "cr", right-aligned (as on the course map). */
function CreditsCell({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-right text-[15px] font-semibold text-soft tabular-nums">
      {children}
      <span className="text-xs font-normal text-faint"> cr</span>
    </span>
  );
}

/**
 * One curriculum slot: the title (15/500) over the code chip and a 13px meta line, then Hidden and
 * the credits on the right. The chip wears the course's hue (a lab shares its theory course's); an
 * elective placeholder like ELECT1 is not a course, so its code prints plain with no hue. Choice
 * slots join their codes with "/" and take the first code's hue, as on the course map.
 */
function CourseRow({ course, onOpen }: { course: ModCourse; onOpen: () => void }) {
  const label = slotLabel(course);
  const placeholder = course.kind === "elective";
  const meta = (
    <>
      {placeholder ? <span className="wrap-anywhere">{label.code} · elective</span> : null}
      {course.semester !== null ? (
        <span>
          {placeholder ? " · " : ""}semester <span className="tabular-nums">{course.semester}</span>
        </span>
      ) : null}
    </>
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-tint active:bg-tint ${press} ${focusRingInset}`}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-[1.35] font-medium text-ink">
          {label.title}
        </p>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {placeholder ? null : (
            <CourseCode
              code={label.code}
              hueFrom={label.code.split("/")[0]}
              className="min-w-0 shrink whitespace-normal wrap-anywhere"
            />
          )}
          <span className="text-[13px] leading-[1.3] font-medium text-faint">{meta}</span>
        </p>
      </div>
      {course.hidden ? <Badge className="shrink-0">Hidden</Badge> : null}
      {course.nonCredit ? (
        <span className="shrink-0 text-right text-[13px] leading-[1.3] font-medium text-faint">
          non-credit
        </span>
      ) : (
        <CreditsCell>{formatCredits(course.credits)}</CreditsCell>
      )}
    </button>
  );
}
