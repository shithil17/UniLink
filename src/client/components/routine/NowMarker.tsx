import type { CSSProperties } from "react";
import { formatClock } from "@/lib/routine";
import { cn } from "@/lib/utils";
import { minutesToTime } from "../../../shared/routine";
import { dhakaMinutes } from "../../../shared/time";

/**
 * The now marker: a `brand` line and dot with the Dhaka time in a pill at the left, moved with
 * `transform`. The parent sets the hour height (`--hh`) and passes `offset`, the hours from its
 * top. Only the transform animates (900ms linear, so a 30 s tick glides); reduced motion jumps.
 * `ring` is the color the dot's ring blends into: `app` on the ground, `surface` inside a panel.
 */
export function NowMarker({
  offset,
  now,
  ring = "app",
}: {
  offset: number;
  now: number;
  ring?: "app" | "surface";
}) {
  const clock = formatClock(minutesToTime(dhakaMinutes(now))).slice(0, -3);
  return (
    <div
      aria-hidden
      data-slot="now-marker"
      style={{ "--at": offset } as CSSProperties}
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-0 [transform:translateY(calc(var(--hh)_*_var(--at)))] motion-safe:transition-transform motion-safe:duration-900 motion-safe:ease-linear"
    >
      <span className="absolute top-[-10px] left-0 h-5 min-w-11 rounded-full bg-brand px-1.5 text-center text-xs leading-5 font-bold text-primary-foreground">
        {clock}
      </span>
      <span
        className={cn(
          "absolute top-[-6px] left-[46px] size-3 rounded-full bg-brand outline-[3px]",
          ring === "surface" ? "outline-surface" : "outline-app",
        )}
      />
      <span className="absolute top-[-1px] right-0 left-[58px] h-0.5 rounded-sm bg-brand" />
    </div>
  );
}
