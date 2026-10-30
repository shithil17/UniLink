import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { markRoadmapTipDone, readRoadmapTipDone } from "@/lib/roadmapTip";

// Three semester rows of course boxes; the lines run from a box down to what it unlocks.
const BOXES = [
  { x: 4, y: 4, hue: "fill-mint" },
  { x: 64, y: 4, hue: "fill-sky" },
  { x: 124, y: 4, hue: "fill-lilac" },
  { x: 4, y: 40, hue: "fill-butter" },
  { x: 64, y: 40, hue: "fill-peach" },
  { x: 124, y: 40, hue: "fill-mint" },
  { x: 34, y: 76, hue: "fill-rose" },
  { x: 94, y: 76, hue: "fill-sky" },
  { x: 154, y: 76, hue: "fill-lilac" },
] as const;
const LINES = [
  "M22 24V40",
  "M82 24V30H22V37",
  "M142 24V40",
  "M82 60V68H172V73",
  "M22 60V68H52V73",
  "M142 60V68H112V73",
];

const HEADS = [
  "M22 40l-3-5h6z",
  "M142 40l-3-5h6z",
  "M52 76l-3-5h6z",
  "M112 76l-3-5h6z",
  "M172 76l-3-5h6z",
];

function MiniRoadmap() {
  return (
    <svg
      viewBox="0 0 200 104"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="h-28 w-full"
    >
      <g
        className="fill-none stroke-edge"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {LINES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="fill-edge">
        {HEADS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {BOXES.map(({ x, y, hue }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="36" height="24" rx="6" className={hue} />
      ))}
    </svg>
  );
}

/**
 * Points List users at the roadmap. The X hides it until the course map is opened again; it stays
 * away for good only when "Don't show again" is ticked first.
 */
export function RoadmapTeaser({ onOpen, panelClass }: { onOpen: () => void; panelClass: string }) {
  const [hidden, setHidden] = useState(readRoadmapTipDone);
  const [never, setNever] = useState(false);
  if (hidden) return null;
  return (
    <section aria-label="Roadmap tip" className={`${panelClass} relative mt-4 grid gap-3`}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Hide roadmap tip"
        className="absolute top-1 right-1"
        onClick={() => {
          if (never) markRoadmapTipDone();
          setHidden(true);
        }}
      >
        <X />
      </Button>
      <MiniRoadmap />
      <div className="grid gap-1">
        <h2 className="text-[16px] leading-[1.3] font-semibold text-ink">
          See your degree as a roadmap
        </h2>
        <p className="text-[14px] leading-[1.45] text-soft">
          Every semester in a row, with lines from each course to what it unlocks.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={onOpen}>
          Open roadmap
          <ArrowRight aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2">
          <Checkbox
            id="roadmap-tip-never"
            className="size-5 [&_svg]:size-4"
            checked={never}
            onCheckedChange={(checked) => setNever(checked)}
          />
          <label htmlFor="roadmap-tip-never" className="cursor-pointer text-[13px] text-soft">
            Don&apos;t show again
          </label>
        </div>
      </div>
    </section>
  );
}
