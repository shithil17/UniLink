import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import type { Db } from "../db/client";
import { attempts, faculty, resourceRequests, resourceSubmissions, users } from "../db/schema";
import { limits } from "../limits";
import { visibleTo, type Viewer } from "./visibility";

export type ResourceRequestRow = typeof resourceRequests.$inferSelect;
export type ResourceSubmissionRow = typeof resourceSubmissions.$inferSelect;

/** A request with its faculty member's label, for the screens. */
export type ResourceRequestWithFaculty = ResourceRequestRow & {
  facultyName: string | null;
  facultyInitials: string | null;
};

export type NewResourceRequest = Omit<
  typeof resourceRequests.$inferInsert,
  "id" | "fulfilledAt" | "acceptedSubmissionId" | "deletedAt" | "deletedBy"
>;
export type NewResourceSubmission = Omit<
  typeof resourceSubmissions.$inferInsert,
  "id" | "rejectedAt" | "deletedAt" | "deletedBy"
>;

/** A published link with its uploader's public handle. */
export type SubmissionWithUploader = ResourceSubmissionRow & { uploader: string | null };

const requestWithFaculty = {
  ...getTableColumns(resourceRequests),
  facultyName: faculty.name,
  facultyInitials: faculty.initials,
};

/** A request still open at `now`: screened in, not removed, not fulfilled, not lapsed. */
const openAt = (now: number) =>
  and(
    eq(resourceRequests.status, "published"),
    isNull(resourceRequests.deletedAt),
    isNull(resourceRequests.fulfilledAt),
    gt(resourceRequests.expiresAt, now),
  );

/** A link that counts towards the caps: not turned down, not removed, not rejected by the screen. */
const liveSubmission = and(
  isNull(resourceSubmissions.rejectedAt),
  isNull(resourceSubmissions.deletedAt),
  ne(resourceSubmissions.status, "rejected"),
);

export function resourceRequestsRepo(db: Db) {
  return {
    async insert(row: NewResourceRequest): Promise<number> {
      const created = await db
        .insert(resourceRequests)
        .values(row)
        .returning({ id: resourceRequests.id })
        .get();
      return created.id;
    },
    async find(id: number): Promise<ResourceRequestWithFaculty | null> {
      return (
        (await db
          .select(requestWithFaculty)
          .from(resourceRequests)
          .leftJoin(faculty, eq(faculty.id, resourceRequests.facultyId))
          .where(eq(resourceRequests.id, id))
          .get()) ?? null
      );
    },
    /** A request the viewer may see (the shared visibility filter), not removed. Null otherwise. */
    async findVisible(id: number, viewer: Viewer): Promise<ResourceRequestWithFaculty | null> {
      return (
        (await db
          .select(requestWithFaculty)
          .from(resourceRequests)
          .leftJoin(faculty, eq(faculty.id, resourceRequests.facultyId))
          .where(
            and(
              eq(resourceRequests.id, id),
              isNull(resourceRequests.deletedAt),
              visibleTo(resourceRequests, viewer),
            ),
          )
          .get()) ?? null
      );
    },
    /** One page of a user's own requests, newest first. `beforeId` is the last id of the previous page. */
    async listMine(
      authorId: number,
      limit: number,
      beforeId: number | null,
    ): Promise<ResourceRequestWithFaculty[]> {
      return db
        .select(requestWithFaculty)
        .from(resourceRequests)
        .leftJoin(faculty, eq(faculty.id, resourceRequests.facultyId))
        .where(
          and(
            eq(resourceRequests.authorId, authorId),
            isNull(resourceRequests.deletedAt),
            beforeId === null ? undefined : lt(resourceRequests.id, beforeId),
          ),
        )
        .orderBy(desc(resourceRequests.id))
        .limit(limit)
        .all();
    },
    /** How many requests a user has that are still open or waiting for review. Walks the author index. */
    async countOpenMine(authorId: number, now: number): Promise<number> {
      const row = await db
        .select({ n: count() })
        .from(resourceRequests)
        .where(
          and(
            eq(resourceRequests.authorId, authorId),
            ne(resourceRequests.status, "rejected"),
            isNull(resourceRequests.deletedAt),
            isNull(resourceRequests.fulfilledAt),
            gt(resourceRequests.expiresAt, now),
          ),
        )
        .get();
      return row?.n ?? 0;
    },
    /**
     * Who to tell about a request: users with one attempt matching every field the request sets, minus
     * the requester and banned users. One indexed read of `attempts` (`attempts_course_faculty_idx` or
     * `attempts_faculty_course_idx`), capped. Returns ids only: the attempts themselves are never read
     * out, and the requester is never told who matched.
     */
    async matchingUserIds(
      authorId: number,
      match: { courseCode: string | null; facultyId: number | null },
    ): Promise<number[]> {
      const rows = await db
        .selectDistinct({ userId: attempts.userId })
        .from(attempts)
        .innerJoin(users, eq(users.id, attempts.userId))
        .where(
          and(
            ne(attempts.userId, authorId),
            isNull(users.bannedAt),
            match.courseCode === null ? undefined : eq(attempts.courseCode, match.courseCode),
            match.facultyId === null ? undefined : eq(attempts.facultyId, match.facultyId),
          ),
        )
        .limit(limits.resourceFanoutMax)
        .all();
      return rows.map((r) => r.userId);
    },
    /**
     * The requester accepts one link. A single guarded UPDATE: it only fulfils a request that is still
     * open, theirs and not lapsed, and only when the link is one of its published, live links. Two
     * accepts racing fulfil it once. False when any guard fails.
     */
    async accept(
      requestId: number,
      authorId: number,
      submissionId: number,
      now: number,
    ): Promise<boolean> {
      const rows = await db
        .update(resourceRequests)
        .set({ fulfilledAt: now, acceptedSubmissionId: submissionId })
        .where(
          and(
            eq(resourceRequests.id, requestId),
            eq(resourceRequests.authorId, authorId),
            openAt(now),
            sql`exists (
              select 1 from ${resourceSubmissions}
              where ${resourceSubmissions.id} = ${submissionId}
                and ${resourceSubmissions.requestId} = ${requestId}
                and ${resourceSubmissions.status} = 'published'
                and ${resourceSubmissions.rejectedAt} is null
                and ${resourceSubmissions.deletedAt} is null
            )`,
          ),
        )
        .returning({ id: resourceRequests.id });
      return rows.length > 0;
    },
    /** Short labels for the report queue ("CSE115 · TF"), by request id. Missing ids have no label. */
    async labelsByIds(ids: number[]): Promise<Map<number, string>> {
      const labels = new Map<number, string>();
      const unique = [...new Set(ids)];
      for (let i = 0; i < unique.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({
            id: resourceRequests.id,
            courseCode: resourceRequests.courseCode,
            facultyName: faculty.name,
            facultyInitials: faculty.initials,
          })
          .from(resourceRequests)
          .leftJoin(faculty, eq(faculty.id, resourceRequests.facultyId))
          .where(inArray(resourceRequests.id, unique.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) {
          const who = r.facultyName === null ? null : (r.facultyInitials ?? r.facultyName);
          labels.set(r.id, [r.courseCode, who].filter((x) => x !== null).join(" · "));
        }
      }
      return labels;
    },
    /** Hard-deletes requests that lapsed without being fulfilled. Their links go with them (cascade). */
    async purgeExpiredOpen(now: number): Promise<number> {
      const rows = await db
        .delete(resourceRequests)
        .where(and(isNull(resourceRequests.fulfilledAt), lt(resourceRequests.expiresAt, now)))
        .returning({ id: resourceRequests.id });
      return rows.length;
    },
    /** Hard-deletes requests fulfilled before `cutoff`. Their links go with them (cascade). */
    async purgeFulfilledBefore(cutoff: number): Promise<number> {
      const rows = await db
        .delete(resourceRequests)
        .where(
          and(isNotNull(resourceRequests.fulfilledAt), lt(resourceRequests.fulfilledAt, cutoff)),
        )
        .returning({ id: resourceRequests.id });
      return rows.length;
    },
  };
}

export function resourceSubmissionsRepo(db: Db) {
  return {
    async insert(row: NewResourceSubmission): Promise<number> {
      const created = await db
        .insert(resourceSubmissions)
        .values(row)
        .returning({ id: resourceSubmissions.id })
        .get();
      return created.id;
    },
    async find(id: number): Promise<ResourceSubmissionRow | null> {
      return (
        (await db.select().from(resourceSubmissions).where(eq(resourceSubmissions.id, id)).get()) ??
        null
      );
    },
    /** The link itself, by submission id, for the report queue: mods judge a reported link by where it points. */
    async urlsByIds(ids: number[]): Promise<Map<number, string>> {
      const urls = new Map<number, string>();
      const unique = [...new Set(ids)];
      for (let i = 0; i < unique.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: resourceSubmissions.id, url: resourceSubmissions.url })
          .from(resourceSubmissions)
          .where(inArray(resourceSubmissions.id, unique.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) urls.set(r.id, r.url);
      }
      return urls;
    },
    /** Published, live links for these requests, oldest first, with the uploader's handle. For the requester only. */
    async listPublishedFor(requestIds: number[]): Promise<SubmissionWithUploader[]> {
      if (requestIds.length === 0) return [];
      const rows = await db
        .select({ submission: resourceSubmissions, uploader: users.username })
        .from(resourceSubmissions)
        .leftJoin(users, eq(users.id, resourceSubmissions.authorId))
        .where(
          and(
            inArray(resourceSubmissions.requestId, requestIds),
            eq(resourceSubmissions.status, "published"),
            isNull(resourceSubmissions.deletedAt),
          ),
        )
        .orderBy(resourceSubmissions.id)
        .all();
      return rows.map((r) => ({ ...r.submission, uploader: r.uploader }));
    },
    /** A user's own links to one request, oldest first. */
    async listOwn(requestId: number, authorId: number): Promise<ResourceSubmissionRow[]> {
      return db
        .select()
        .from(resourceSubmissions)
        .where(
          and(
            eq(resourceSubmissions.requestId, requestId),
            eq(resourceSubmissions.authorId, authorId),
            isNull(resourceSubmissions.deletedAt),
          ),
        )
        .orderBy(resourceSubmissions.id)
        .all();
    },
    /** Links that count towards the per-request cap. Walks the request index. */
    async countLive(requestId: number): Promise<number> {
      const row = await db
        .select({ n: count() })
        .from(resourceSubmissions)
        .where(and(eq(resourceSubmissions.requestId, requestId), liveSubmission))
        .get();
      return row?.n ?? 0;
    },
    /** One user's links that count towards the per-user cap on one request. */
    async countLiveBy(requestId: number, authorId: number): Promise<number> {
      const row = await db
        .select({ n: count() })
        .from(resourceSubmissions)
        .where(
          and(
            eq(resourceSubmissions.requestId, requestId),
            eq(resourceSubmissions.authorId, authorId),
            liveSubmission,
          ),
        )
        .get();
      return row?.n ?? 0;
    },
    /**
     * The requester turns a link down. One guarded UPDATE: the link must be on one of their requests that
     * is still unfulfilled and not already turned down. False otherwise.
     */
    async reject(id: number, requesterId: number, now: number): Promise<boolean> {
      const rows = await db
        .update(resourceSubmissions)
        .set({ rejectedAt: now })
        .where(
          and(
            eq(resourceSubmissions.id, id),
            isNull(resourceSubmissions.rejectedAt),
            isNull(resourceSubmissions.deletedAt),
            inArray(
              resourceSubmissions.requestId,
              db
                .select({ id: resourceRequests.id })
                .from(resourceRequests)
                .where(
                  and(
                    eq(resourceRequests.authorId, requesterId),
                    isNull(resourceRequests.fulfilledAt),
                    isNull(resourceRequests.deletedAt),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: resourceSubmissions.id });
      return rows.length > 0;
    },
  };
}
