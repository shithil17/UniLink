import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { reports, users } from "../db/schema";

export type ReportRow = typeof reports.$inferSelect;
export type ReportStatus = ReportRow["status"];

export type NewReport = Pick<
  typeof reports.$inferInsert,
  "targetType" | "targetId" | "reporterId" | "reason" | "createdAt"
>;

/** A report with the reporter's public handle (null if the reporter account is gone). */
export type ReportWithReporter = ReportRow & { reporter: string | null };

export type CreateReportResult = { ok: true; id: number } | { ok: false; duplicate: true };

/** The partial unique index on open reports names these columns in its failure message. */
function isDuplicateOpenReport(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (/UNIQUE constraint failed: reports\./i.test(e.message)) return true;
  }
  return false;
}

export function reportsRepo(db: Db) {
  return {
    /** Files a report. A second open report from the same reporter on the same target is a duplicate. */
    async create(report: NewReport): Promise<CreateReportResult> {
      try {
        const row = await db.insert(reports).values(report).returning({ id: reports.id }).get();
        return { ok: true, id: row.id };
      } catch (err) {
        if (isDuplicateOpenReport(err)) return { ok: false, duplicate: true };
        throw err;
      }
    },
    async findById(id: number): Promise<ReportRow | null> {
      return (await db.select().from(reports).where(eq(reports.id, id)).get()) ?? null;
    },
    /**
     * One page of reports with a status. The open queue runs oldest first (work through it in order);
     * the closed lists run newest first. `cursor` is the last id of the previous page.
     */
    async listPage(
      status: ReportStatus,
      limit: number,
      cursor: number | null,
    ): Promise<ReportWithReporter[]> {
      const oldestFirst = status === "open";
      const rows = await db
        .select({ report: reports, reporter: users.username })
        .from(reports)
        .leftJoin(users, eq(users.id, reports.reporterId))
        .where(
          and(
            eq(reports.status, status),
            cursor === null
              ? undefined
              : oldestFirst
                ? gt(reports.id, cursor)
                : lt(reports.id, cursor),
          ),
        )
        .orderBy(oldestFirst ? asc(reports.id) : desc(reports.id))
        .limit(limit)
        .all();
      return rows.map((r) => ({ ...r.report, reporter: r.reporter }));
    },
    /** Closes an open report. Null when it is already closed (or does not exist): one UPDATE, no read first. */
    async resolve(
      id: number,
      outcome: Exclude<ReportStatus, "open">,
      by: number,
      note: string | null,
      now: number,
    ): Promise<ReportRow | null> {
      const row = await db
        .update(reports)
        .set({ status: outcome, resolvedBy: by, resolvedAt: now, resolveNote: note })
        .where(and(eq(reports.id, id), eq(reports.status, "open")))
        .returning()
        .get();
      return row ?? null;
    },
  };
}
