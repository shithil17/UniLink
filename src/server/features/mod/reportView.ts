import type { z } from "zod";
import type { modReport } from "../../../shared/schemas/moderation";
import type { Db } from "../../db/client";
import type { ReportWithReporter } from "../../repos/reports";
import { reportTargets } from "./reportTargets";

/** A report as mods see it, with the target's public label. */
export type ModReportView = z.infer<typeof modReport>;

/** Maps a page of reports to what mods see. One label lookup per target type, not per row. */
export async function toModReports(db: Db, rows: ReportWithReporter[]): Promise<ModReportView[]> {
  const labels = new Map<string, string>();
  for (const [type, target] of Object.entries(reportTargets)) {
    const ids = rows.filter((r) => r.targetType === type).map((r) => Number(r.targetId));
    for (const [id, label] of await target.labels(db, ids)) labels.set(`${type}:${id}`, label);
  }
  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType as "user",
    targetId: r.targetId,
    targetLabel: labels.get(`${r.targetType}:${r.targetId}`) ?? null,
    reporter: r.reporter,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    resolveNote: r.resolveNote,
  }));
}
