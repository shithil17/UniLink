import { describePrereq } from "@/lib/courseMap";
import type { PrereqRule } from "../../../shared/schemas/courses";

export function PrereqText({ rule }: { rule: PrereqRule | null }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-soft">Prerequisites</h3>
      <p className="text-sm text-body">{describePrereq(rule) ?? "None"}</p>
    </div>
  );
}
