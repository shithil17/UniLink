import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { weekdayBit } from "../../shared/rides";
import { DHAKA_OFFSET_MS, parseDhakaDate, startOfDhakaDay } from "../../shared/time";
import type { Db } from "../db/client";
import { areas, rides } from "../db/schema";
import { limits } from "../limits";
import { notExpired } from "./postLifecycle";
import { visibleTo, type Viewer } from "./visibility";

// Every read of a ride joins its two areas for their names, so the views never need a second query.
const pickupArea = alias(areas, "pickup_area");
const destinationArea = alias(areas, "destination_area");

/** A ride with the names of its pickup and destination areas (shown as they are now, hidden or not). */
export type RideRow = typeof rides.$inferSelect & {
  pickupAreaName: string;
  destinationAreaName: string;
};

/** A ride as the feed and "my rides" read it: everything but the exact points, which only the detail selects. */
export type RideSummaryRow = Omit<
  RideRow,
  "pickupLat" | "pickupLng" | "destinationLat" | "destinationLng"
>;

const {
  pickupLat: _pickupLat,
  pickupLng: _pickupLng,
  destinationLat: _destinationLat,
  destinationLng: _destinationLng,
  ...summaryColumns
} = getTableColumns(rides);

/** The whole ride, exact points included: for the detail, the author's edit and the responses to them. */
const selectRides = (db: Db) =>
  db
    .select({
      ...getTableColumns(rides),
      pickupAreaName: pickupArea.name,
      destinationAreaName: destinationArea.name,
    })
    .from(rides)
    .innerJoin(pickupArea, eq(pickupArea.id, rides.pickupAreaId))
    .innerJoin(destinationArea, eq(destinationArea.id, rides.destinationAreaId));

/** The same without the four point columns, so a list query never reads them. */
const selectRideSummaries = (db: Db) =>
  db
    .select({
      ...summaryColumns,
      pickupAreaName: pickupArea.name,
      destinationAreaName: destinationArea.name,
    })
    .from(rides)
    .innerJoin(pickupArea, eq(pickupArea.id, rides.pickupAreaId))
    .innerJoin(destinationArea, eq(destinationArea.id, rides.destinationAreaId));

export type NewRide = Omit<typeof rides.$inferInsert, "id" | "deletedAt" | "deletedBy">;

/**
 * What an edit can write. Seats left are not here: they only change through `setSeatsRemaining()` or,
 * when `totalSeats` changes, in the same UPDATE as the total. Moderation columns are here because an
 * edit that changes screened text saves the new screening result with it.
 */
export type RidePatch = Partial<
  Omit<
    typeof rides.$inferInsert,
    | "id"
    | "authorId"
    | "seatsRemaining"
    | "kind"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
    | "deletedBy"
  >
>;

/** Where a feed page starts: just after the last row of the previous page, in (expires_at, id) order. */
export type RideCursor = { expiresAt: number; id: number };

export type RideFeedFilter = {
  /**
   * Text fallback: a substring of either landmark or either area name. `like '%x%'` cannot use an
   * index, so it only ever runs over the live rows the other conditions leave, never the whole table.
   */
  q?: string;
  /** Pickup area id. A top-level area also matches its sub-areas. */
  from?: number;
  /** Destination area id, matched the same way. */
  to?: number;
  vehicle?: RideRow["vehicle"];
  /** A Dhaka day, "YYYY-MM-DD". */
  date?: string;
  /** A Dhaka weekday number, 0 (Sunday) to 6. */
  day?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 1 January 1970 was a Thursday, which is weekday 4 with Sunday as 0.
const EPOCH_WEEKDAY = 4;

/** `like` with `\` as the escape, so a search for "50%" or "a_b" matches those characters only. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/** The weekday (0 to 6, Dhaka) a one-off ride departs on, as SQL. Integer arithmetic on `departs_at`. */
const departureWeekday = sql`(((${rides.departsAt} + ${sql.raw(String(DHAKA_OFFSET_MS))}) / ${sql.raw(String(MS_PER_DAY))} + ${sql.raw(String(EPOCH_WEEKDAY))}) % 7)`;

/** Recurring rides that run on this weekday. The bit is inlined: it is one of 1, 2, 4 ... 64. */
const recursOn = (weekday: number) =>
  sql`(${rides.kind} = 'recurring' and (${rides.days} & ${sql.raw(String(weekdayBit(weekday)))}) != 0)`;

/**
 * Rides whose `column` is the area or one of its sub-areas. One subquery over `areas`: the id is the
 * primary key and the children come from `areas_parent_idx`, and an area has one level of children.
 */
const inArea = (column: SQLiteColumn, areaId: number) =>
  sql`${column} in (select ${areas.id} from ${areas} where ${areas.id} = ${areaId} or ${areas.parentId} = ${areaId})`;

function filterConditions(filter: RideFeedFilter): (SQL | undefined)[] {
  const conditions: (SQL | undefined)[] = [];
  if (filter.from !== undefined) conditions.push(inArea(rides.pickupAreaId, filter.from));
  if (filter.to !== undefined) conditions.push(inArea(rides.destinationAreaId, filter.to));
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    conditions.push(
      sql`(${rides.pickupLandmark} like ${pattern} escape '\\' or ${rides.destinationLandmark} like ${pattern} escape '\\' or ${pickupArea.name} like ${pattern} escape '\\' or ${destinationArea.name} like ${pattern} escape '\\')`,
    );
  }
  if (filter.vehicle) conditions.push(eq(rides.vehicle, filter.vehicle));
  if (filter.date) {
    const date = parseDhakaDate(filter.date);
    if (date) {
      const start = startOfDhakaDay(date);
      const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
      conditions.push(
        or(
          and(
            eq(rides.kind, "one_off"),
            sql`${rides.departsAt} >= ${start} and ${rides.departsAt} < ${start + MS_PER_DAY}`,
          ),
          // Still running that day: its last day is on or after it.
          and(recursOn(weekday), sql`${rides.endsOn} >= ${filter.date}`),
        ),
      );
    }
  }
  if (filter.day !== undefined) {
    conditions.push(
      or(
        recursOn(filter.day),
        and(eq(rides.kind, "one_off"), sql`${departureWeekday} = ${sql.raw(String(filter.day))}`),
      ),
    );
  }
  return conditions;
}

/**
 * What the public feed and the Map view's counts both show: published, not removed, not lapsed and
 * visible to the viewer. A viewer's own held ride is in "my rides", not here, so it is not counted either.
 */
const liveFeedConditions = (viewer: Viewer, now: number): (SQL | undefined)[] => [
  eq(rides.status, "published"),
  isNull(rides.deletedAt),
  visibleTo(rides, viewer),
  notExpired(rides, now),
];

export function ridesRepo(db: Db) {
  return {
    async insert(row: NewRide): Promise<number> {
      const created = await db.insert(rides).values(row).returning({ id: rides.id }).get();
      return created.id;
    },
    async find(id: number): Promise<RideRow | null> {
      return (await selectRides(db).where(eq(rides.id, id)).get()) ?? null;
    },
    /** A ride the viewer may see (the shared visibility filter), not removed. Null otherwise. Expiry is the caller's call. */
    async findVisible(id: number, viewer: Viewer): Promise<RideRow | null> {
      return (
        (await selectRides(db)
          .where(and(eq(rides.id, id), isNull(rides.deletedAt), visibleTo(rides, viewer)))
          .get()) ?? null
      );
    },
    /**
     * One page of a user's own rides, newest first, whatever their status and including lapsed ones (so
     * a lapsed recurring ride can be renewed). `beforeId` is the last id of the previous page.
     */
    async listMine(
      authorId: number,
      limit: number,
      beforeId: number | null,
    ): Promise<RideSummaryRow[]> {
      return selectRideSummaries(db)
        .where(
          and(
            eq(rides.authorId, authorId),
            isNull(rides.deletedAt),
            beforeId === null ? undefined : lt(rides.id, beforeId),
          ),
        )
        .orderBy(desc(rides.id))
        .limit(limit)
        .all();
    },
    /** How many rides a user has that are still live or waiting for review. Walks the author index. */
    async countOpenMine(authorId: number, now: number): Promise<number> {
      const row = await db
        .select({ n: count() })
        .from(rides)
        .where(
          and(
            eq(rides.authorId, authorId),
            ne(rides.status, "rejected"),
            isNull(rides.deletedAt),
            notExpired(rides, now),
          ),
        )
        .get();
      return row?.n ?? 0;
    },
    /**
     * One page of the public feed, soonest to lapse first (a one-off's departure; a recurring ride sorts
     * by its end date), keyset-paged by `(expires_at, id)` so the walk uses `rides_expires_idx` and
     * never reads a lapsed row. Published, not removed, not lapsed, and visible to the viewer; full rides
     * stay in. Walks `rides_expires_idx` (or `rides_vehicle_expires_idx` for a vehicle filter, or an area
     * index for an area filter); the text, date and day filters apply to the live rows only. Fetch `limit + 1` rows to know if there is a next page.
     */
    async feed(
      viewer: Viewer,
      now: number,
      filter: RideFeedFilter,
      limit: number,
      cursor: RideCursor | null,
    ): Promise<RideSummaryRow[]> {
      return selectRideSummaries(db)
        .where(
          and(
            ...liveFeedConditions(viewer, now),
            cursor
              ? or(
                  gt(rides.expiresAt, cursor.expiresAt),
                  and(eq(rides.expiresAt, cursor.expiresAt), gt(rides.id, cursor.id)),
                )
              : undefined,
            ...filterConditions(filter),
          ),
        )
        .orderBy(rides.expiresAt, rides.id)
        .limit(limit)
        .all();
    },
    /**
     * How many live rides the feed would show for these filters, per area, for the Map view: one grouped
     * query over published rides that have not lapsed, with a primary-key join to the ride's area for the
     * roll-up. It reads `rides_status_expires_idx (status, expires_at)`, which exists for this query: the
     * counts have no ORDER BY to steer the planner to `rides_expires_idx` (as the feed has), so without
     * it SQLite walks `rides_status_id_idx` over every published ride, lapsed ones included. A vehicle
     * filter uses `rides_vehicle_expires_idx`. `q`, `from` and `to` are ignored. A sub-area with no point
     * of its own is counted under its parent, because the map has nowhere to put it; one with its own
     * point, and an area with no point at all, count as themselves. Counts only: no ride, point,
     * contact or author leaves the query.
     */
    async areaCounts(
      viewer: Viewer,
      now: number,
      by: "pickup" | "destination",
      filter: Pick<RideFeedFilter, "vehicle" | "date" | "day">,
    ): Promise<{ areaId: number; count: number }[]> {
      const area = alias(areas, "counted_area");
      const column = by === "pickup" ? rides.pickupAreaId : rides.destinationAreaId;
      const rolledUp = sql<number>`case when ${area.lat} is null and ${area.parentId} is not null then ${area.parentId} else ${area.id} end`;
      return db
        .select({ areaId: rolledUp.as("area_id"), count: count() })
        .from(rides)
        .innerJoin(area, eq(area.id, column))
        .where(and(...liveFeedConditions(viewer, now), ...filterConditions(filter)))
        .groupBy(rolledUp)
        .orderBy(rolledUp)
        .all();
    },
    /**
     * Writes an edit to a ride that is not removed. When `totalSeats` changes, the seats already taken
     * stay taken: seats left becomes the new total minus those, never below 0, in the same UPDATE, so
     * the count is always within `0..total_seats` (the CHECK is the backstop). Returns false when the
     * ride is gone.
     */
    async update(id: number, patch: RidePatch, now: number): Promise<boolean> {
      const { totalSeats, ...rest } = patch;
      const rows = await db
        .update(rides)
        .set({
          ...rest,
          updatedAt: now,
          ...(totalSeats === undefined
            ? {}
            : {
                totalSeats,
                seatsRemaining: sql`max(0, ${totalSeats} - (${rides.totalSeats} - ${rides.seatsRemaining}))`,
              }),
        })
        .where(and(eq(rides.id, id), isNull(rides.deletedAt)))
        .returning({ id: rides.id });
      return rows.length > 0;
    },
    /**
     * The poster sets the seats left. One guarded UPDATE: it only writes a number within `0..total_seats`
     * on the poster's own ride that is not removed, so two requests racing can never leave it out of
     * range and nothing is clamped. False when the ride is not theirs or the number is out of range.
     */
    async setSeatsRemaining(
      id: number,
      authorId: number,
      seatsRemaining: number,
      now: number,
    ): Promise<boolean> {
      const rows = await db
        .update(rides)
        .set({ seatsRemaining, updatedAt: now })
        .where(
          and(
            eq(rides.id, id),
            eq(rides.authorId, authorId),
            isNull(rides.deletedAt),
            sql`${seatsRemaining} between 0 and ${rides.totalSeats}`,
          ),
        )
        .returning({ id: rides.id });
      return rows.length > 0;
    },
    /** Pushes a recurring ride's end date out. Guarded on the poster, the kind and not being removed. */
    async renew(
      id: number,
      authorId: number,
      next: { expiresAt: number; endsOn: string },
      now: number,
    ): Promise<boolean> {
      const rows = await db
        .update(rides)
        .set({ expiresAt: next.expiresAt, endsOn: next.endsOn, updatedAt: now })
        .where(
          and(
            eq(rides.id, id),
            eq(rides.authorId, authorId),
            eq(rides.kind, "recurring"),
            isNull(rides.deletedAt),
          ),
        )
        .returning({ id: rides.id });
      return rows.length > 0;
    },
    /**
     * Short labels for the report queue, by ride id: "Pickup area → Destination area", each with its
     * landmark in parentheses when it has one. Screened text, never a contact. Missing ids have no label.
     */
    async labelsByIds(ids: number[]): Promise<Map<number, string>> {
      const labels = new Map<number, string>();
      const unique = [...new Set(ids)];
      for (let i = 0; i < unique.length; i += limits.d1MaxBoundParams) {
        const rows = await selectRideSummaries(db)
          .where(inArray(rides.id, unique.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) {
          const end = (area: string, landmark: string | null) =>
            landmark ? `${area} (${landmark})` : area;
          labels.set(
            r.id,
            `${end(r.pickupAreaName, r.pickupLandmark)} → ${end(r.destinationAreaName, r.destinationLandmark)}`,
          );
        }
      }
      return labels;
    },
    /** The poster's user id, by ride id, for the report queue. Missing ids are absent. */
    async authorIdsByIds(ids: number[]): Promise<Map<number, number>> {
      const authors = new Map<number, number>();
      const unique = [...new Set(ids)];
      for (let i = 0; i < unique.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: rides.id, authorId: rides.authorId })
          .from(rides)
          .where(inArray(rides.id, unique.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) authors.set(r.id, r.authorId);
      }
      return authors;
    },
  };
}
