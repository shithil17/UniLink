import type { z } from "zod";
import type { reportTargetType } from "../../../shared/schemas/common";
import type { Db } from "../../db/client";
import { usersRepo } from "../../repos/users";

type ReportTargetType = z.infer<typeof reportTargetType>;

/** How a kind of target takes part in reporting. Each post type adds one entry, with its enum value. */
export type ReportTarget = {
  /** The target's owner, or null when it does not exist (or is not visible to reporters). */
  find(db: Db, id: number): Promise<{ ownerId: number } | null>;
  /** Public labels for the queue (a username for a user), by target id. Missing ids have no label. */
  labels(db: Db, ids: number[]): Promise<Map<number, string>>;
};

export const reportTargets: Record<ReportTargetType, ReportTarget> = {
  user: {
    async find(db, id) {
      return (await usersRepo(db).findForMods(id)) ? { ownerId: id } : null;
    },
    labels: (db, ids) => usersRepo(db).usernamesByIds(ids),
  },
};
