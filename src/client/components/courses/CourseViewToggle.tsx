import { focusRing } from "@/components/ui/focus";

export function CourseViewToggle({
  view,
  onChange,
}: {
  view: "list" | "sequence";
  onChange: (view: "list" | "sequence") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Course map view"
      className="hidden shrink-0 items-center gap-1 rounded-control bg-tint p-1 md:flex"
    >
      {(["list", "sequence"] as const).map((next) => (
        <button
          key={next}
          type="button"
          aria-pressed={view === next}
          className={`min-h-10 rounded-control px-4 text-[14px] capitalize transition-colors ${view === next ? "bg-chip font-semibold text-ink" : "font-medium text-soft hover:text-ink"} ${focusRing}`}
          onClick={() => onChange(next)}
        >
          {next}
        </button>
      ))}
    </div>
  );
}
