import type { CSSProperties } from "react";
import { progressPercent } from "@/lib/courseMap";
import { cn } from "@/lib/utils";

/**
 * Earned against required: a 14px `track` pill with the `brand` fill revealed by `clip-path`, never
 * by width. Full once the total is reached, even when over it; a real zero shows nothing filled.
 */
export function CreditBar({
  earned,
  required,
  label = "Credits earned",
  className,
}: {
  earned: number;
  required: number;
  label?: string;
  className?: string;
}) {
  const percent = progressPercent(earned, required);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className={cn("relative h-3.5 overflow-hidden rounded-full bg-track", className)}
      style={{ "--p": `${percent}%` } as CSSProperties}
    >
      <div
        data-slot="credit-bar-fill"
        className="absolute inset-0 bg-brand [clip-path:inset(0_calc(100%-var(--p))_0_0_round_999px)] motion-safe:transition-[clip-path] motion-safe:duration-700 motion-safe:ease-ui-out"
      />
    </div>
  );
}
