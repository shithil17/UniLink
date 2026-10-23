import { chipClass } from "@/components/ui/chip";
import { categoryAnchor } from "@/lib/courseMap";
import { cn } from "@/lib/utils";

/**
 * A horizontal row of chip-styled buttons, one per category. Tapping one scrolls that category's
 * heading into view (smooth, or instant under reduced motion). They are actions, not toggles, so
 * they carry no pressed state. The row scrolls sideways on a phone and wraps from `md`.
 */
export function CategoryJump({
  names,
  extras = false,
  className,
}: {
  names: readonly string[];
  /** Add a last chip for the student's own extra courses. */
  extras?: boolean;
  className?: string;
}) {
  const jump = (id: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <nav
      aria-label="Jump to a category"
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {names.map((name) => (
        <button
          key={name}
          type="button"
          className={chipClass}
          onClick={() => jump(categoryAnchor(name))}
        >
          {name}
        </button>
      ))}
      {extras ? (
        <button type="button" className={chipClass} onClick={() => jump("extras")}>
          Your extra courses
        </button>
      ) : null}
    </nav>
  );
}
