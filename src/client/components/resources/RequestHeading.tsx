import { CourseCode } from "@/components/courses/CourseCode";
import { requestHeading } from "@/lib/resources";
import type { ResourceRequest } from "../../../shared/schemas/resources";

/** What a request is about: the course chip in its own hue and the faculty member, either or both. */
export function RequestHeading({
  request,
}: {
  request: Pick<ResourceRequest, "courseCode" | "faculty">;
}) {
  const { course, faculty } = requestHeading(request);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {course ? <CourseCode code={course} /> : null}
      {faculty ? (
        <span className="min-w-0 text-[15px] leading-[1.3] font-semibold text-ink">{faculty}</span>
      ) : null}
    </div>
  );
}
