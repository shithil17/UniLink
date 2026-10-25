import type { CSSProperties } from "react";
import { courseHue } from "@/lib/courseHue";
import { useNow } from "@/lib/useNow";
import { blockBox, classesOn, nowOffset, todayLetter } from "@/lib/sampleWeek";
import { cn } from "@/lib/utils";
import { ROUTINE_DAYS } from "../../../shared/routine";

/**
 * A small week board for the login screen, drawn in the routine's own language: one row per NSU day
 * letter running 8 AM to 3 PM, each class a soft block in its course hue with the code printed on it,
 * today's letter on the `brand-soft` pill and the `brand` now line on today's row (Dhaka time). The
 * classes are a made-up sample, so the board is hidden from screen readers.
 */
export function SampleWeek() {
  const now = useNow();
  const today = todayLetter(now);
  const nowAt = nowOffset(now);

  return (
    <div aria-hidden="true" className="rounded-panel bg-surface p-4 md:rounded-[24px]">
      <div className="grid grid-cols-[1.5rem_1fr] gap-x-2 gap-y-1">
        <span />
        <span className="flex justify-between text-[11px] leading-4 text-faint tabular-nums">
          <span>8 AM</span>
          <span>3 PM</span>
        </span>
        {ROUTINE_DAYS.map((day, row) => {
          const isToday = day === today;
          return (
            <div key={day} className="contents">
              <span
                className={cn(
                  "flex h-6 items-center justify-center rounded-full text-[12px] leading-none font-semibold",
                  isToday ? "bg-brand-soft text-brand-ink" : "text-faint",
                )}
              >
                {day}
              </span>
              <div
                className={cn("relative h-6 rounded-[6px]", isToday ? "bg-tint" : "bg-transparent")}
              >
                {classesOn(day).map((c) => {
                  const { left, width } = blockBox(c.start, c.end);
                  return (
                    <span
                      key={c.code}
                      data-hue={courseHue(c.code)}
                      className="week-reveal absolute inset-y-0 flex items-center overflow-hidden rounded-[6px] bg-hue px-1.5 text-[11px] leading-none font-semibold whitespace-nowrap text-hue-ink tabular-nums"
                      style={{ left: `${left}%`, width: `${width}%`, "--k": row } as CSSProperties}
                    >
                      {c.code}
                    </span>
                  );
                })}
                {isToday && nowAt !== null ? (
                  <span
                    className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-brand"
                    style={{ left: `${nowAt}%` }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
