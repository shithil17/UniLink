import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { formatCredits } from "@/lib/courseMap";
import { searchCourses } from "@/lib/courseSearch";
import { useAddStudentCourse } from "@/lib/courses";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CourseMapTrails } from "../../../shared/schemas/courses";
import { StateMark } from "./StateMark";

type TrailCourse = CourseMapTrails["trails"][number]["courses"][number];

const rowClass = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

/** The mark in front of a trail course: filled when done, hollow when added, a plus when addable. */
function CourseMark({ state }: { state: TrailCourse["state"] }) {
  if (state === null) {
    return <PlusIcon aria-hidden="true" className="size-4 shrink-0 text-faint" />;
  }
  return <StateMark status={state === "done" ? "done" : "available"} />;
}

/**
 * Every trail with its courses, searchable by code or title. One tap on a course the student has
 * not added creates the student course in `category`; done and added courses show but cannot be
 * added again. "Course not listed" hands over to the free form for special-topics courses.
 */
export function TrailPicker({
  category,
  trails,
  onAdded,
  onNotListed,
}: {
  category: string;
  trails: CourseMapTrails;
  onAdded: () => void;
  onNotListed: () => void;
}) {
  const add = useAddStudentCourse();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    if (query.trim() === "") return null;
    const all = trails.trails.flatMap((t) => t.courses);
    return new Set(searchCourses(all, query).map((c) => c.code));
  }, [trails, query]);
  const visible = trails.trails
    .map((trail) => ({
      trail,
      courses: matches ? trail.courses.filter((c) => matches.has(c.code)) : trail.courses,
    }))
    .filter((t) => t.courses.length > 0);

  const pick = (course: TrailCourse) => {
    add.mutate(
      {
        code: course.code,
        title: course.title,
        credits: course.credits,
        category,
        excluded: false,
      },
      {
        onSuccess: () => {
          toast.success(`${course.code} added`);
          onAdded();
        },
        // code_taken lands here too, e.g. the code was already added under another category.
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <>
      <SheetHeader className="pb-0">
        <SheetTitle>Pick a trail course</SheetTitle>
        <SheetDescription>
          Tap a course to add it. It fills your next open elective.
        </SheetDescription>
      </SheetHeader>
      <div className="relative px-5">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-faint"
        />
        <Input
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
      <p role="status" className="sr-only">
        {visible.reduce((n, t) => n + t.courses.length, 0)} found
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line">
        {visible.map(({ trail, courses }) => (
          <section key={trail.name} aria-label={trail.name}>
            <div className="flex items-baseline justify-between gap-3 border-b border-line bg-tint px-4 py-2">
              <h3 className="text-sm font-semibold text-ink">{trail.name}</h3>
              <span className="shrink-0 text-sm text-soft tabular-nums">
                {trail.done} of {trails.minFromOneTrail} done
              </span>
            </div>
            <ul className="divide-y divide-line border-b border-line">
              {courses.map((course) => (
                <li key={course.code}>
                  <button
                    type="button"
                    disabled={course.state !== null || add.isPending}
                    onClick={() => pick(course)}
                    className={cn(
                      rowClass,
                      "transition-colors hover:bg-tint disabled:cursor-default disabled:hover:bg-transparent",
                      focusRingInset,
                    )}
                  >
                    <CourseMark state={course.state} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-medium",
                          course.state ? "text-soft" : "text-ink",
                        )}
                      >
                        {course.title}
                      </span>
                      <span className="block truncate text-sm text-soft">{course.code}</span>
                    </span>
                    {course.state ? (
                      <Badge className="shrink-0">
                        {course.state === "done" ? "Done" : "Added"}
                      </Badge>
                    ) : null}
                    <span className="shrink-0 text-right text-sm text-soft tabular-nums">
                      {formatCredits(course.credits)} cr
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-soft">No course matches that search.</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-soft">Course not listed?</p>
        <Button variant="outline" size="lg" onClick={onNotListed}>
          Add it yourself
        </Button>
      </div>
    </>
  );
}
