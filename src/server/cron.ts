import { auditActions } from "../shared/auditActions";
import { audit } from "./audit";
import type { Db } from "./db/client";
import { getDb } from "./db/client";
import { limits } from "./limits";
import { postLifecycleRepo, type PurgeablePostTable } from "./repos/postLifecycle";
import { resourceRequestsRepo } from "./repos/resources";

/**
 * Scheduled cleanup. Cron Triggers fire in UTC, so a job that cares about a local day computes it in
 * Asia/Dhaka itself. Each job is one function that deletes from one table and says how many rows it
 * removed. A later phase adds its job to `cronJobs` and never edits another phase's job.
 *
 * Hard deletion happens here and nowhere else: mods only soft-delete.
 */
export type CronJob = {
  name: string;
  /** The audit target type of the table the job deletes from. */
  targetType: string;
  /** Deletes what is due at `now` (UTC epoch ms). Returns how many rows it removed. */
  run(db: Db, now: number): Promise<number>;
};

/** Open requests whose expiry has passed, with their links. */
export const purgeExpiredResourceRequests: CronJob = {
  name: "resource_requests:expired",
  targetType: "resource_request",
  run: (db, now) => resourceRequestsRepo(db).purgeExpiredOpen(now),
};

/** Fulfilled requests, with their links, once the keep period after fulfilment is over. */
export const purgeFulfilledResourceRequests: CronJob = {
  name: "resource_requests:fulfilled",
  targetType: "resource_request",
  run: (db, now) =>
    resourceRequestsRepo(db).purgeFulfilledBefore(now - limits.resourceFulfilledKeepMs),
};

/**
 * The cleanup job of a post table that follows the shared post kit: hard-deletes rows past their
 * expiry window and author-deleted rows past the purge window, never one with an open report (see
 * `postLifecycleRepo`). A post type adds its job to `cronJobs` with one line:
 *
 *   postPurgeJob("rides", "ride", rides)
 *
 * A type with photos wraps `postLifecycleRepo(...).purgeDue(now)` itself to delete files from the ids it returns.
 */
export function postPurgeJob(name: string, targetType: string, table: PurgeablePostTable): CronJob {
  return {
    name,
    targetType,
    run: async (db, now) => (await postLifecycleRepo(db, table, targetType).purgeDue(now)).length,
  };
}

export const cronJobs: readonly CronJob[] = [
  purgeExpiredResourceRequests,
  purgeFulfilledResourceRequests,
];

/**
 * Runs every job in turn. A job that throws is logged and the rest still run, so one broken cleanup
 * never blocks another. Each job that removed rows writes one audit row. Returns the rows each job removed, by job name (a failed job is absent).
 */
export async function runCronJobs(
  db: Db,
  now: number = Date.now(),
  jobs: readonly CronJob[] = cronJobs,
): Promise<Record<string, number>> {
  const removed: Record<string, number> = {};
  for (const job of jobs) {
    try {
      const n = await job.run(db, now);
      // Every automatic action is audited; a job that removed nothing has nothing to record. A failed
      // audit write counts as the job failing.
      if (n > 0) {
        await audit(
          db,
          {
            actor: "system",
            action: auditActions.cronPurge,
            targetType: job.targetType,
            targetId: job.name,
            reason: `removed ${n} rows`,
          },
          now,
        );
      }
      removed[job.name] = n;
    } catch (err) {
      console.error("cron job failed", job.name, err instanceof Error ? err.name : "unknown");
    }
  }
  return removed;
}

/** The Worker's `scheduled()` handler. */
export async function scheduled(
  _controller: ScheduledController,
  env: Pick<Env, "DB">,
  ctx: ExecutionContext,
): Promise<void> {
  ctx.waitUntil(runCronJobs(getDb(env.DB)));
}
