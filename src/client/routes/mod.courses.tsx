import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { CourseEditSheet, type CourseSheetTarget } from "@/components/mod/CourseEditSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/mod/courses")({
  component: CoursesPage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

const curriculumLabel = (c: ModCurriculum) => `${c.programCode} ${c.programName} · ${c.version}`;

function CoursesPage() {
  const curricula = useQuery(modCurriculaQuery);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const list = curricula.data ?? [];
  const curriculum = list.find((c) => c.id === pickedId) ?? list[0] ?? null;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Courses</h1>
      {curricula.isPending ? (
        <div className={`${flat} h-11`} aria-busy="true" aria-label="Loading curricula" />
      ) : curricula.isError ? (
        <ErrorBlock
          title="The curricula didn't load"
          error={curricula.error}
          onRetry={() => void curricula.refetch()}
        />
      ) : curriculum === null ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">No curricula yet</p>
          <p className="mt-1 text-sm text-soft">Import a curriculum first, then edit it here.</p>
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

function ErrorBlock({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-soft">{errorMessage(error)}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-soft">
          Effective from admission year{" "}
          <span className="tabular-nums">{curriculum.effectiveFromYear}</span>
        </p>
        <Button size="lg" onClick={() => openNew(null)}>
          <PlusIcon data-icon="inline-start" />
          Add course
        </Button>
      </div>

      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
        />
        <Input
          id="mod-courses-search"
          type="search"
          className="h-11 pl-9"
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
      <div className="flex min-h-11 items-center gap-3">
        <Switch id="show-hidden-courses" checked={showHidden} onCheckedChange={setShowHidden} />
        <Label htmlFor="show-hidden-courses" className="text-sm text-body">
          Show hidden
          {hiddenCount > 0 ? (
            <span className="text-faint tabular-nums"> ({hiddenCount})</span>
          ) : null}
        </Label>
      </div>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading courses">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-1/3`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <ErrorBlock
          title="The courses didn't load"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : shown === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">No courses found</p>
          <p className="mt-1 text-sm text-soft">
            {query || showHidden
              ? "No course matches that search."
              : "This curriculum has no courses yet."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.name} aria-label={group.name} className={panel}>
            <SectionHeader
              title={group.name}
              count={group.courses.length}
              className="px-4 pt-3"
              action={
                <Button variant="ghost" size="sm" onClick={() => openNew(group.name)}>
                  Add here
                </Button>
              }
            />
            <ul>
              {group.courses.map((course) => (
                <li key={course.id} className="border-b border-line last:border-b-0">
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

function CourseRow({ course, onOpen }: { course: ModCourse; onOpen: () => void }) {
  const label = slotLabel(course);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-tint ${focusRingInset}`}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium text-ink">{label.title}</p>
        <p className="text-sm text-soft wrap-anywhere">
          {label.code}
          {course.kind === "elective" ? " · elective" : ""}
          {course.semester !== null ? (
            <>
              {" · semester "}
              <span className="tabular-nums">{course.semester}</span>
            </>
          ) : null}
        </p>
      </div>
      {course.hidden ? <Badge>Hidden</Badge> : null}
      <span className="shrink-0 text-right text-sm text-soft tabular-nums">
        {course.nonCredit ? "non-credit" : `${formatCredits(course.credits)} cr`}
      </span>
    </button>
  );
}
