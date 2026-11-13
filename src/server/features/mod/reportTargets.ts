import type { z } from "zod";
import type { reportTargetType } from "../../../shared/schemas/common";
import type { Db } from "../../db/client";
import { resourceRequestsRepo, resourceSubmissionsRepo } from "../../repos/resources";
import { ridesRepo } from "../../repos/rides";
import { usersRepo } from "../../repos/users";

type ReportTargetType = z.infer<typeof reportTargetType>;

/** How a kind of target takes part in reporting. Each post type adds one entry, with its enum value. */
export type ReportTarget = {
  /**
   * The target's owner, or null when it does not exist or `viewerId` could not see it (a post the
   * reporter is not allowed to read is not found, the same as a missing one).
   */
  find(db: Db, id: number, viewerId: number): Promise<{ ownerId: number } | null>;
  /** Public labels for the queue (a username for a user), by target id. Missing ids have no label. */
  labels(db: Db, ids: number[]): Promise<Map<number, string>>;
  /** The owner's user id (the user themself for a user), by target id. Missing ids have no owner. */
  owners(db: Db, ids: number[]): Promise<Map<number, number>>;
};

export const reportTargets: Record<ReportTargetType, ReportTarget> = {
  user: {
    async find(db, id) {
      return (await usersRepo(db).findForMods(id)) ? { ownerId: id } : null;
    },
    labels: (db, ids) => usersRepo(db).usernamesByIds(ids),
    async owners(db, ids) {
      const found = await usersRepo(db).usernamesByIds(ids);
      return new Map([...found.keys()].map((id) => [id, id]));
    },
  },
  resource_request: {
    async find(db, id, viewerId) {
      const request = await resourceRequestsRepo(db).find(id);
      if (!request || request.deletedAt !== null) return null;
      // A request is public once it is published; before that only its author can see it.
      if (request.status !== "published" && request.authorId !== viewerId) return null;
      return { ownerId: request.authorId };
    },
    labels: (db, ids) => resourceRequestsRepo(db).labelsByIds(ids),
    owners: (db, ids) => resourceRequestsRepo(db).authorIdsByIds(ids),
  },
  resource_submission: {
    async find(db, id, viewerId) {
      const submission = await resourceSubmissionsRepo(db).find(id);
      if (!submission || submission.deletedAt !== null) return null;
      if (submission.authorId === viewerId) return { ownerId: submission.authorId };
      // Only the requester ever sees a link, and only once it is published.
      if (submission.status !== "published") return null;
      const request = await resourceRequestsRepo(db).find(submission.requestId);
      if (!request || request.deletedAt !== null || request.authorId !== viewerId) return null;
      return { ownerId: submission.authorId };
    },
    // Mods judge a reported link by where it points, so its label is the link itself.
    labels: (db, ids) => resourceSubmissionsRepo(db).urlsByIds(ids),
    owners: (db, ids) => resourceSubmissionsRepo(db).authorIdsByIds(ids),
  },
  ride: {
    async find(db, id, viewerId) {
      const ride = await ridesRepo(db).find(id);
      if (!ride || ride.deletedAt !== null) return null;
      // A ride is public once it is published; before that only its poster can see it.
      if (ride.status !== "published" && ride.authorId !== viewerId) return null;
      return { ownerId: ride.authorId };
    },
    // "Pickup → Destination", never a contact.
    labels: (db, ids) => ridesRepo(db).labelsByIds(ids),
    owners: (db, ids) => ridesRepo(db).authorIdsByIds(ids),
  },
};
