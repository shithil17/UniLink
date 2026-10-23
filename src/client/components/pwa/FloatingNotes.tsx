import { XIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * The shelf the PWA notes (update prompt, install hint) float on. It sits at the toast's bottom
 * offset, `--toast-bottom` (above the phone tab bar, 24px from the corner once the bar is a rail),
 * centered with a 16px side inset. Notes stack in a column, so two at once never overlap. The shelf
 * itself ignores pointer events; only the notes take them.
 */
export function FloatingNotes({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-(--toast-bottom) z-20 flex flex-col items-center gap-2">
      {children}
    </div>
  );
}

/**
 * A compact floating note: `surface` ground, float shadow, no border, a real Dismiss button.
 * Escape dismisses while focus is inside the note. Enter motion lives in `index.css`
 * (`.floating-note`): a short rise with opacity, opacity only under reduced motion.
 */
export function FloatingNote({
  role,
  className,
  onDismiss,
  children,
}: {
  role: "status" | "note";
  className?: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onDismiss();
  };

  return (
    <div
      role={role}
      onKeyDown={onKeyDown}
      className={cn(
        "floating-note pointer-events-auto flex max-w-104 items-center gap-1 rounded-panel bg-surface py-1.5 pr-1.5 pl-4 text-[15px] leading-snug text-body shadow-float",
        className,
      )}
    >
      {children}
      <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss}>
        <XIcon />
      </Button>
    </div>
  );
}
