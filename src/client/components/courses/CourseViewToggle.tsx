import { List, Waypoints } from "lucide-react";
import { focusRing } from "@/components/ui/focus";

const VIEWS = [
  { value: "list", label: "List", Icon: List },
  { value: "sequence", label: "Roadmap", Icon: Waypoints },
] as const;

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
      className="hidden shrink-0 items-center gap-1 rounded-full bg-track p-1 md:flex"
    >
      {VIEWS.map(({ value, label, Icon }) => {
        const active = view === value;
        // While List is showing, Roadmap is an invitation, so it takes the brand accent.
        const invite = !active && value === "sequence";
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14px] transition-colors ${active ? "bg-surface font-semibold text-ink" : invite ? "font-semibold text-brand-ink hover:bg-brand-soft" : "font-medium text-soft hover:text-ink"} ${focusRing}`}
            onClick={() => onChange(value)}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
