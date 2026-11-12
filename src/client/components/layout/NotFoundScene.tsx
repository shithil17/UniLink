import { cn } from "@/lib/utils";

type Block = { col: number; row: number; span: 1 | 2; hue: string };

// Sunday to Thursday, like the routine screen's week.
const DAYS = ["S", "M", "T", "W", "T"];
const GRID_X = 132;
const COL_W = 44;
const COL_GAP = 6;
const GRID_Y = 62;
const ROW_H = 32;
const ROW_GAP = 6;

// NSU classes run in pairs (Sun + Tue, Mon + Wed), so a course repeats two days apart. The peach
// course keeps its Monday slot and loses its Wednesday one: that slot is the 404.
const BLOCKS: Block[] = [
  { col: 0, row: 0, span: 2, hue: "mint" },
  { col: 2, row: 0, span: 2, hue: "mint" },
  { col: 1, row: 0, span: 1, hue: "lilac" },
  { col: 3, row: 0, span: 1, hue: "lilac" },
  { col: 4, row: 1, span: 1, hue: "butter" },
  { col: 0, row: 2, span: 2, hue: "sky" },
  { col: 2, row: 2, span: 2, hue: "sky" },
  { col: 1, row: 2, span: 2, hue: "peach" },
  { col: 4, row: 3, span: 1, hue: "butter" },
];
const MISSING: Block = { col: 3, row: 2, span: 2, hue: "peach" };

const colX = (col: number) => GRID_X + col * (COL_W + COL_GAP);
const rowY = (row: number) => GRID_Y + row * (ROW_H + ROW_GAP);
const height = (span: 1 | 2) => (span === 1 ? ROW_H : ROW_H * 2 + ROW_GAP);

/**
 * The 404 scene: a student with a backpack points at a week of class blocks where one slot, the
 * Wednesday half of a Monday course, is a dashed hole marked 404. Everything is flat shapes in theme
 * tokens (course hues for the class blocks, the accent for the missing slot), so every palette,
 * Night included, recolors it. Blocks settle in once (`.nf-pop`, off under reduced motion).
 */
export function NotFoundScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 252"
      role="img"
      aria-label="A student with a backpack points at a weekly routine where one class slot is empty and marked 404."
      className={cn("h-auto w-full", className)}
    >
      <g aria-hidden="true">
        {/* The path the student stands on. */}
        <rect x="10" y="230" width="380" height="4" rx="2" className="fill-edge" opacity=".35" />

        {/* The routine board. */}
        <rect x="118" y="22" width="272" height="198" rx="20" className="fill-surface" />
        {DAYS.map((day, i) => (
          <text
            key={i}
            x={colX(i) + COL_W / 2}
            y="48"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            className="fill-faint"
          >
            {day}
          </text>
        ))}

        {BLOCKS.map((b, i) => (
          <g
            key={i}
            data-hue={b.hue}
            className="nf-pop"
            style={{ "--k": i } as React.CSSProperties}
          >
            <rect
              x={colX(b.col)}
              y={rowY(b.row)}
              width={COL_W}
              height={height(b.span)}
              rx="10"
              className="fill-hue"
            />
            <rect
              x={colX(b.col) + 8}
              y={rowY(b.row) + 9}
              width="22"
              height="4"
              rx="2"
              className="fill-hue-ink"
            />
            {b.span === 2 ? (
              <rect
                x={colX(b.col) + 8}
                y={rowY(b.row) + 19}
                width="14"
                height="4"
                rx="2"
                className="fill-hue-ink"
                opacity=".5"
              />
            ) : null}
          </g>
        ))}

        {/* The missing slot. */}
        <g className="nf-pop" style={{ "--k": 10 } as React.CSSProperties}>
          <rect
            x={colX(MISSING.col) + 1}
            y={rowY(MISSING.row) + 1}
            width={COL_W - 2}
            height={height(MISSING.span) - 2}
            rx="9"
            strokeWidth="2"
            strokeDasharray="5 5"
            className="fill-brand-soft stroke-brand"
          />
          <text
            x={colX(MISSING.col) + COL_W / 2}
            y={rowY(MISSING.row) + height(MISSING.span) / 2 + 6}
            textAnchor="middle"
            fontSize="17"
            fontWeight="700"
            className="fill-brand-ink"
          >
            404
          </text>
        </g>

        {/* The student: geometric, no identity. Backpack behind, one arm out toward the board. */}
        <rect x="24" y="112" width="26" height="54" rx="12" className="fill-brand" />
        <rect x="46" y="170" width="15" height="58" rx="7.5" className="fill-ink" />
        <rect x="66" y="170" width="15" height="58" rx="7.5" className="fill-ink" />
        <rect x="38" y="104" width="48" height="74" rx="22" className="fill-soft" />
        <rect x="60" y="110" width="6" height="42" rx="3" className="fill-brand-ink" />
        <circle cx="64" cy="82" r="17" className="fill-ink" />
        <path
          d="M76 122 L104 106"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          className="stroke-ink"
        />
      </g>
    </svg>
  );
}
