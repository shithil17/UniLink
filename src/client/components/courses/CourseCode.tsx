import { courseHue } from "@/lib/courseHue";
import { cn } from "@/lib/utils";

/** A course code as a pill in the course's own hue. Sets `data-hue`, so marks inside its row can inherit it. */
export function CourseCode({ code, className }: { code: string; className?: string }) {
  return (
    <span
      data-hue={courseHue(code)}
      data-slot="course-code"
      className={cn(
        "inline-block shrink-0 rounded-full bg-hue px-2 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap text-hue-ink tabular-nums",
        className,
      )}
    >
      {code}
    </span>
  );
}
