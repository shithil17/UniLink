import { Calculator, List, Waypoints } from "lucide-react";
import { focusRing } from "@/components/ui/focus";

export type CourseView = "list" | "sequence" | "planner";

// Roadmap needs the room of a tablet or desktop, so phones get List and Planner only.
const VIEWS = [
  { value: "list", label: "List", Icon: List, phone: true },
  { value: "planner", label: "Planner", Icon: Calculator, phone: true },
  { value: "sequence", label: "Roadmap", Icon: Waypoints, phone: false },
] as const;

export function CourseViewToggle({
  view,
  onChange,
}: {
  view: CourseView;
  onChange: (view: CourseView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Course map view"
      className="flex w-full shrink-0 items-center gap-1 rounded-full bg-track p-1 md:w-auto"
    >
      {VIEWS.map(({ value, label, Icon, phone }) => {
        const active = view === value;
        // While List is showing, Roadmap is an invitation, so it takes the brand accent.
        const invite = !active && value === "sequence";
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            className={`${phone ? "inline-flex" : "hidden md:inline-flex"} min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[14px] transition-colors md:flex-none ${active ? "bg-surface font-semibold text-ink" : invite ? "font-semibold text-brand-ink hover:bg-brand-soft" : "font-medium text-soft hover:text-ink"} ${focusRing}`}
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
