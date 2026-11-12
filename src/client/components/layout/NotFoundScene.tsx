import { cn } from "@/lib/utils";

type Block = { col: number; row: number; span: 1 | 2; hue: string };
type Shape = [className: string, d: string];

// Sunday to Thursday, like the routine screen's week.
const DAYS = ["S", "M", "T", "W", "T"];
const BOARD_X = 204;
const GRID_X = BOARD_X + 12;
const COL_W = 36;
const COL_GAP = 5;
const GRID_Y = 62;
const ROW_H = 32;
const ROW_GAP = 6;
const BOARD_W = 12 * 2 + COL_W * 5 + COL_GAP * 4;

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

/*
 * The two students are assembled from Humaaans by Pablo Stanley (CC0, humaaans.com): the head, torso
 * and legs parts, flattened to one path list each (drawn in the parts' own 380 x 480 space, shading
 * layers dropped, coordinates rounded). Every fill is a theme token: skin and hair from the `skin-*`
 * tokens, clothes from the course hues, trousers and shoes from the ink tiers, so each palette,
 * Night included, recolors them. A lighter `opacity-75` marks the far sleeve.
 */
const MAIN: Shape[] = [
  [
    "fill-skin-1",
    "M184.3 96.5C179.7 91.1 176.5 84.5 177.1 77C178.6 55.6 208.3 60.3 214.1 71.1C219.9 81.9 219.2 109.3 211.8 111.3C208.8 112 202.4 110.1 195.9 106.2L200 135L176 135L184.3 96.5Z",
  ],
  [
    "fill-skin-hair",
    "M208.7 64C208.2 63.7 207 63 206.5 62.7C206.3 62.7 205.3 62 205.3 62C204.6 62.2 202.5 63.2 202.3 63.9C202.3 64 202.2 64.1 202.2 64.1C201.9 64.7 201.6 65.2 201.4 65.8C200.8 67 200.3 68.3 199.8 69.6C198.9 72.1 198.1 74.7 197.4 77.2C196.6 79.9 196 82.5 195.3 85.1C194.2 88.9 192.9 92.6 191.9 96.4C191.2 98.8 190.9 101.3 191 103.7C191 103.8 191 103.8 191 103.8C191 103.8 191.1 103.9 191.1 103.9C191.1 104.2 191.1 104.6 191.2 105C191.2 105.3 191.3 105.7 191.3 106C192.3 104.1 193 102.1 193.7 100.1C193.8 100 193.9 99.8 193.9 99.6C194.2 99.2 194.4 98.8 194.7 98.4C196.3 95.9 197.9 93.5 199.4 91C202.1 86.5 204.8 81.9 208.1 77.7C209 76.5 210 75.3 210.9 74.1C211.5 73.4 212 72.7 212.5 71.9C212.9 71.4 214.4 69.6 213.9 68.5C213.6 68 210.2 64.9 208.7 64Z",
  ],
  [
    "fill-lilac-ink",
    "M206.6 62.8C207.2 63 206.9 61.9 206.4 61.5C204 59.7 194.8 59 186.8 60.7C181.5 61.8 175.3 64.6 171 68.1C167.1 71.3 164.5 76.4 163.1 81.4C161.7 86.6 161.5 92 162.3 97.4C162.5 98.6 162.8 99.7 163 100.8C163.3 102.1 163.4 103.4 163.8 104.6C164.1 105.4 164.5 106.1 164.7 106.9C165 107.8 164.8 108.6 164.7 109.5C164.4 111 164 112.4 163.5 113.8C162.7 115.9 161.7 117.9 161.1 120.1C160.3 123 157 132.4 159.4 135L205.9 135C204.8 131.8 201.2 128 200.5 124.6C200.1 122.6 199.9 118.2 199.9 118C198.8 110.8 196.8 107.4 195.5 106.1C194.2 104.9 192.5 104.5 192.4 103.4C192.1 98.9 193.8 94.6 195.1 90.4C196.7 85.4 197.9 80.3 199.5 75.3C200.2 73.1 203.9 61.9 206.6 62.8Z",
  ],
  ["fill-ink", "M168 218L204.3 345.2L230.7 439L250 439L221.9 218Z"],
  [
    "fill-soft",
    "M158.3 218C157.5 283.6 154.6 319.3 153.7 325.3C152.8 331.3 139.5 369.2 113.8 439L133.8 439C166.5 372 184.8 334.1 188.7 325.3C192.5 316.5 204.3 280.7 222 218L158.3 218Z",
  ],
  [
    "fill-ink",
    "M112 457L113 436L134 436C144 443 157 448.7 173 453L173 457L135 457L122 455L122 457L112 457Z",
  ],
  [
    "fill-ink",
    "M228 457L229 436L250 436C260 443 273 448.7 289 453L289 457L251 457L238 455L238 457L228 457Z",
  ],
  [
    "fill-skin-1",
    "M220.6 155.7L255.3 136.7C261.1 129.8 266.8 124.5 272.4 120.7C274.1 120 277.1 119.6 274.3 124.5C271.5 129.5 268.8 134.9 270.2 136.4C271.6 137.9 275.2 135.8 276.9 138.3C278 140 272 142.7 258.7 146.4L233.5 169.5L220.6 155.7ZM275 171.7L290.2 163.4C292.4 155.2 294.9 151.1 297.9 151.1C300.2 150 296.2 160.3 300.6 159.4C304.9 158.5 315.5 150.7 317.3 152.2C320 154.6 317.6 161.9 314.7 165.5C309.5 172.2 305.1 174.5 294.2 177.5C288.6 179.1 282.5 182.3 275.9 187L275 171.7Z",
  ],
  [
    "fill-lilac-ink opacity-75",
    "M203.7 151.5C215.9 151.3 232.1 148.8 249.4 137.8L256.2 152.9C244.3 164.8 227.5 174.5 212.8 174.1C201.3 173.8 195.3 159.8 203.7 151.5Z",
  ],
  [
    "fill-lilac-ink",
    "M220.1 175.8C233 179 254.7 175.2 285 164.4C292.6 180 296.1 191.1 295.5 197.7C269.4 211.3 247.1 217.4 228.7 217.8C229.3 228.7 227.9 239.1 223.5 248.6C214.3 268.1 160.5 250 142.5 253.6C131.2 216.9 153 201.9 153.1 178.4C153.1 152.6 173.8 113 176.8 113L204.5 113C206.1 132.7 213.8 154.3 220.1 175.8Z",
  ],
];
const FRIEND: Shape[] = [
  [
    "fill-skin-2",
    "M184.3 96.5C179.7 91.1 176.5 84.5 177.1 77C178.6 55.6 208.3 60.3 214.1 71.1C219.9 81.9 219.2 109.3 211.8 111.3C208.8 112 202.4 110.1 195.9 106.2L200 135L176 135L184.3 96.5Z",
  ],
  [
    "fill-skin-hair",
    "M182.4 101.3C179.4 87.9 170.8 78.8 172.1 72.8C173 68.8 175.3 66.3 179.1 65.3C181.1 57.4 187.4 54 198.1 55.2C214.1 57 223.8 63.6 219.6 78.3C215.7 78.3 211 76.9 204.6 79.3C202.5 80 201.1 82.4 200.2 86.4L197.2 86.4C194.4 81.7 191.6 79.9 188.9 81.2C186.1 82.4 185.5 85.4 187 90.3L185.5 101.3L182.4 101.3Z",
  ],
  ["fill-skin-2-deep", "M174 218L223.1 342.2L256 447.3L269 447.3L218.7 218Z"],
  [
    "fill-skin-2",
    "M164.1 218C163.6 261.7 156 320.4 154.8 323.1C153.9 325 125.9 348 70.7 392.4L79.6 401.9C144.8 363.9 178.9 342.4 181.9 337.3C186.4 329.7 201.2 259.8 213 218L164.1 218Z",
  ],
  [
    "fill-edge",
    "M69.5 389.2C66.5 390.2 64.4 391.2 63.3 392.2C61.9 393.3 60.1 395.3 57.8 397.9C59.1 399.6 71.2 414 94.1 441.2C98.7 439.2 100.2 436.8 98.4 434.2C96.7 431.5 95.3 429.3 94.2 427.5L86.3 399.9C86.1 399.3 85.6 399 85 399.2C85 399.2 85 399.2 85 399.2L80.8 400.5C77.9 399.2 75.8 397.8 74.6 396.4C73.7 395.2 72.8 393.3 72.1 390.5L72.1 390.5C71.8 389.4 70.7 388.8 69.6 389.1C69.6 389.1 69.5 389.1 69.5 389.2Z",
  ],
  [
    "fill-edge",
    "M250.7 442.4C249.6 445.4 249 447.6 249 449.1C249 450.9 249.3 453.5 249.9 457C252 457 270.8 457 306.3 457C307.8 452.2 306.9 449.5 303.8 449.2C300.6 448.8 298 448.4 295.9 448.1L269.7 436.4C269.2 436.2 268.6 436.4 268.4 436.9C268.4 436.9 268.4 436.9 268.3 437L266.7 441C263.7 442.4 261.4 443.1 259.5 443.1C258.1 443.1 256 442.5 253.4 441.3L253.4 441.3C252.4 440.8 251.2 441.3 250.7 442.3C250.7 442.3 250.7 442.4 250.7 442.4Z",
  ],
  ["fill-ink", "M207 436.4L268.8 429.7L223 218L167.6 218Z"],
  [
    "fill-soft",
    "M83.5 376.9L124 424.9C166.7 378.2 191.6 347.8 198.7 333.6C205.8 319.4 212.1 280.8 217.8 218L155.5 218C152.4 273.3 150.3 302.2 149.2 304.8C148.2 307.4 126.2 331.4 83.5 376.9Z",
  ],
  [
    "fill-skin-2",
    "M254 178.3L293.5 172.9C301.4 168.5 308.6 165.6 315.3 164C317.1 163.9 320.1 164.6 315.7 168.3C311.3 172 306.8 176.1 307.6 178.1C308.4 180 312.5 179.3 313.2 182.3C313.6 184.3 306.9 184.7 293.1 183.3L261.1 196L254 178.3ZM130 187.4L151.9 187.5C127.9 241.6 115.3 269.9 114.3 272.4C112 278.1 116.9 286.9 119 291.6C112.2 294.6 112.9 283.3 104.3 287.3C96.4 291 90.5 297.6 81.4 292C80.3 291.3 79.1 288.7 82 286.7C89.4 281.6 100 272.8 101.4 269.9C103.4 265.9 112.9 238.5 130 187.4Z",
  ],
  [
    "fill-mint-ink opacity-75",
    "M189.9 118L207.1 119.1C211.3 157.3 234.3 181.5 285.8 173.3L292.7 222.5C244.5 228.7 202.3 209.4 193.7 157.3C191.4 143.8 189.7 129.7 189.9 118Z",
  ],
  [
    "fill-mint-ink",
    "M181.5 113L207.5 119C207.5 163.6 221.7 192.2 229 225L158.8 225C157.9 236.4 157.2 248 156.9 260L104.4 260C116.3 196.7 141.4 147.7 179.8 113L181.5 113L181.5 113Z",
  ],
];

function Figure({ shapes }: { shapes: Shape[] }) {
  return shapes.map(([cls, d], i) => <path key={i} className={cls} d={d} />);
}

/**
 * The 404 scene: a student with a backpack points at a week of class blocks where one slot, the
 * Wednesday half of a Monday course, is a dashed hole marked 404, while a friend walks past
 * checking a phone. The board and the missing slot are flat shapes in theme tokens (course hues for
 * the class blocks, the accent for the missing slot). Blocks settle in once (`.nf-pop`, off under
 * reduced motion); the students are already there.
 */
export function NotFoundScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 438 252"
      role="img"
      aria-label="Two students by a weekly routine: one with a backpack points at it while a friend walks past on a phone. One class slot is empty and marked 404."
      className={cn("h-auto w-full", className)}
    >
      <g aria-hidden="true">
        {/* The path the students stand on. */}
        <rect x="10" y="230" width="418" height="4" rx="2" className="fill-edge" opacity=".35" />

        {/* A friend walking left, eyes on a phone. Mirrored, so the front hand points away. */}
        <g transform="translate(138.4 38.9) scale(-0.42 0.42)" fillRule="evenodd">
          <Figure shapes={FRIEND} />
          <rect x="296" y="148" width="20" height="34" rx="5" className="fill-ink" />
          <rect x="299" y="153" width="14" height="24" rx="3" className="fill-brand-soft" />
        </g>

        {/* The routine board. */}
        <rect x={BOARD_X} y="22" width={BOARD_W} height="198" rx="20" className="fill-surface" />
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
              width="20"
              height="4"
              rx="2"
              className="fill-hue-ink"
            />
            {b.span === 2 ? (
              <rect
                x={colX(b.col) + 8}
                y={rowY(b.row) + 19}
                width="13"
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
            fontSize="16"
            fontWeight="700"
            className="fill-brand-ink"
          >
            404
          </text>
        </g>

        {/* The student with the backpack, one arm out toward the board. */}
        <g transform="translate(40 2.5) scale(0.5)" fillRule="evenodd">
          <rect x="118" y="128" width="42" height="104" rx="20" className="fill-brand" />
          <rect x="118" y="188" width="30" height="36" rx="13" className="fill-brand-ink" />
          <Figure shapes={MAIN} />
          <path
            d="M186 126C178 160 160 190 152 222"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            className="stroke-brand-ink"
          />
        </g>
      </g>
    </svg>
  );
}
