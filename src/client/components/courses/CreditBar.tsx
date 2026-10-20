import { progressPercent } from "@/lib/courseMap";
import { cn } from "@/lib/utils";

/** Earned against required in `brand`; full once the total is reached, even when over it. */
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
      className={cn("h-1 overflow-hidden rounded-full bg-tint", className)}
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
    </div>
  );
}
