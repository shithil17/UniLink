import { cn } from "@/lib/utils";

/**
 * The UniLink mark: a U stem in the current text color with the dot in the palette's brand color,
 * so it follows the chosen theme. Decorative; the link around it carries the name.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-8 -8 846.853 1040"
      aria-hidden="true"
      focusable="false"
      className={cn("h-7 w-auto shrink-0 overflow-visible", className)}
    >
      <path
        className="fill-current"
        fillRule="evenodd"
        d="M 170.152 85.076 L 170.152 610.979 C 170.152 745.111 278.889 853.848 413.021 853.848 C 547.154 853.848 655.891 745.111 655.891 610.979 L 655.891 455.8 C 655.891 408.813 693.98 370.723 740.967 370.723 C 787.953 370.723 826.043 408.813 826.043 455.8 L 826.043 610.979 C 826.043 839.084 641.127 1024 413.021 1024 C 184.916 1024 0 839.084 0 610.979 L 0 85.076 C 0 38.09 38.09 0 85.076 0 C 132.063 0 170.152 38.09 170.152 85.076 Z"
      />
      <circle className="fill-brand" cx="687.185" cy="166.672" r="143.668" />
    </svg>
  );
}
