import { describePrereq } from "@/lib/courseMap";
import type { PrereqRule } from "../../../shared/schemas/courses";
import { StateMark } from "./StateMark";

/**
 * The prerequisite rule in words, for the value side of a facts row. With `met` it leads with an
 * 18px state mark (filled = met, struck = not met); the mark is decorative, a word says the same.
 */
export function PrereqText({ rule, met }: { rule: PrereqRule | null; met?: boolean }) {
  const text = describePrereq(rule);
  if (text === null) return <span>None</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {met === undefined ? null : (
        <>
          <span aria-hidden className="flex shrink-0">
            <StateMark size={18} status={met ? "done" : "locked"} />
          </span>
          <span className="sr-only">{met ? "Met:" : "Not met:"}</span>
        </>
      )}
      <span>{text}</span>
    </span>
  );
}
