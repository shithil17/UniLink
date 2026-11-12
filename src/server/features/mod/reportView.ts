import type { z } from "zod";
import type { modReport } from "../../../shared/schemas/moderation";
import type { Db } from "../../db/client";
import type { ReportWithReporter } from "../../repos/reports";
import { usersRepo } from "../../repos/users";
import { reportTargets } from "./reportTargets";

/** A report as mods see it, with the target's public label and its owner's username. */
export type ModReportView = z.infer<typeof modReport>;

/** Maps a page of reports to what mods see. One label and one owner lookup per target type, plus one username lookup, not per row. */
export async function toModReports(db: Db, rows: ReportWithReporter[]): Promise<ModReportView[]> {
  const labels = new Map<string, string>();
  const ownerIds = new Map<string, number>();
  for (const [type, target] of Object.entries(reportTargets)) {
    const ids = rows.filter((r) => r.targetType === type).map((r) => Number(r.targetId));
    for (const [id, label] of await target.labels(db, ids)) labels.set(`${type}:${id}`, label);
    for (const [id, owner] of await target.owners(db, ids)) ownerIds.set(`${type}:${id}`, owner);
  }
  const usernames = await usersRepo(db).usernamesByIds([...ownerIds.values()]);
  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType as ModReportView["targetType"],
    targetId: r.targetId,
    targetLabel: labels.get(`${r.targetType}:${r.targetId}`) ?? null,
    targetAuthor: usernames.get(ownerIds.get(`${r.targetType}:${r.targetId}`) ?? -1) ?? null,
    reporter: r.reporter,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    resolveNote: r.resolveNote,
  }));
}
