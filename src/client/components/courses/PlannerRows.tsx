import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { courseHue } from "@/lib/courseHue";
import { formatCredits } from "@/lib/courseMap";
import { mockChangesNothing, type PlannerRow } from "@/lib/plannerModel";
import { MOCK_GRADES, type MockPicks } from "@/lib/plannerMocks";
import { PLANNER_ROWS_SHOWN } from "../../../shared/planner";
import { CourseRowBody } from "./CourseRowBody";
import { OptionSelect } from "./OptionSelect";

const NO_MOCK = "none";
const gradeOptions = [
  { value: NO_MOCK, label: "No mock" },
  ...MOCK_GRADES.map((g) => ({ value: g, label: g })),
];

/** The sentence under a row with a mock: what it does, or that it does nothing. Null when there is nothing to add. */
function mockNote(row: PlannerRow, grade: string | undefined): string | null {
  if (!grade || row.best === null) return null;
  return mockChangesNothing(row, grade)
    ? `No change: your best stays ${row.best}.`
    : `Retake: ${row.best} becomes ${grade}.`;
}

function Row({
  row,
  grade,
  onPick,
}: {
  row: PlannerRow;
  grade: string | undefined;
  onPick: (key: string, grade: string | null) => void;
}) {
  const note = mockNote(row, grade);
  const hueFrom = row.code.split("/")[0];
  const detail = [
    `${formatCredits(row.credits)} cr`,
    row.best ? `best ${row.best}` : row.category,
  ].join(" · ");
  return (
    <li
      data-hue={courseHue(hueFrom)}
      // A mocked row takes the accent wash: `tint` is the page colour, so it would read as a hole in the panel.
      className={`border-t border-line px-4 py-3 first:border-t-0 ${grade ? "bg-brand-soft" : ""}`}
    >
      <div className="flex min-h-[60px] items-center gap-3">
        <CourseRowBody
          code={row.code}
          title={row.title}
          status={row.status}
          waived={row.waived}
          // Several codes in one pill: a choice slot nobody has taken yet.
          open={row.code.includes("/")}
          meta={
            <>
              <span className="min-w-0 truncate text-[13px] leading-[1.3] font-medium text-faint tabular-nums">
                {detail}
              </span>
              {grade ? (
                <Badge variant="solid" className="shrink-0">
                  Mock
                </Badge>
              ) : null}
            </>
          }
        />
        <div className="w-[104px] shrink-0">
          <OptionSelect
            id={`mock-${row.key}`}
            ariaLabel={`Mock grade for ${row.code}`}
            value={grade ?? null}
            placeholder="Mock"
            options={gradeOptions}
            onChange={(v) => onPick(row.key, v === NO_MOCK ? null : v)}
          />
        </div>
      </div>
      {note ? <p className="pb-1 pl-8 text-[13px] leading-[1.35] text-soft">{note}</p> : null}
    </li>
  );
}

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

/**
 * A panel of course rows, each with a mock grade picker. A long list opens as a preview so the page
 * stays short; a row with a mock always shows, so a pick never disappears behind "Show all".
 */
export function PlannerList({
  hint,
  rows,
  picks,
  onPick,
}: {
  hint?: string;
  rows: readonly PlannerRow[];
  picks: MockPicks;
  onPick: (key: string, grade: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded
    ? rows
    : rows.filter((row, index) => index < PLANNER_ROWS_SHOWN || picks[row.key]);
  return (
    <div className="grid gap-3">
      <div className={panel}>
        <ul>
          {shown.map((row) => (
            <Row key={row.key} row={row} grade={picks[row.key]} onPick={onPick} />
          ))}
        </ul>
      </div>
      {shown.length < rows.length ? (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          Show all {rows.length}
        </Button>
      ) : null}
      {hint ? <p className="text-sm text-faint">{hint}</p> : null}
    </div>
  );
}
