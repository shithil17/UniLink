import { z } from "zod";
import { geoPoint } from "./geo";
import { reasonBody } from "./moderation";

// Areas: the places rides are posted and filtered by. A top-level area (a district or neighbourhood) can
// have sub-areas one level down. Mods manage them; students only read the visible ones.

// ceiling: an area name is a neighbourhood or a landmark-sized place ("Old Dhaka / Sadarghat"). Revisit if a real name is refused.
export const AREA_NAME_MAX_LENGTH = 60;

export const areaName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .regex(/[\p{L}\p{N}]/u, "Use letters or digits")
  .max(AREA_NAME_MAX_LENGTH, `Use at most ${AREA_NAME_MAX_LENGTH} characters`);

/** A new area. Leave `parentId` out for a top-level area; a sub-area names a top-level parent. */
export const areaInput = z.object({
  name: areaName,
  parentId: z.number().int().positive().optional(),
});

/** A rename. Parent and slug never change. */
export const areaPatch = z.object({ name: areaName });

/** The one area that has no place on the map: students pick it for a ride that starts or ends outside the city. */
export const NO_POINT_AREA_SLUG = "outside-dhaka";

/**
 * A mod sets or moves an area's map point (inside `MAP_BOUNDS`, checked by `geoPoint`), or clears it
 * with `null`. Clearing is allowed so a point that was set on the wrong area can be taken back; a
 * sub-area with no point stands where its parent does.
 */
export const areaPointPatch = z.object({ point: geoPoint.nullable() });

/** Hiding and showing again both need a reason for the audit log. */
export const areaHideRequest = reasonBody;

/** An area as a ride shows it. */
export const areaRef = z.object({ id: z.number().int(), name: z.string() });

/** An area as a picker lists it: visible, with its visible sub-areas. */
export const areaOption = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  /** The area's centre, or null when it has none. Public reference data. */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  children: z.array(
    z.object({
      id: z.number().int(),
      slug: z.string(),
      name: z.string(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    }),
  ),
});

export const areaList = z.array(areaOption);

/** An area as mods see it: every field, hidden ones included. `parentId` null means top level. */
export const modArea = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  parentId: z.number().int().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  hidden: z.boolean(),
  hiddenReason: z.string().nullable(),
});

export const modAreaList = z.array(modArea);

/** The 4xx codes an area write can answer with. */
export const areaFailure = z.enum([
  "not_found",
  "invalid_parent",
  "name_taken",
  "already_hidden",
  "not_hidden",
  "no_point_area",
]);

export type AreaInput = z.output<typeof areaInput>;
export type AreaPatch = z.output<typeof areaPatch>;
export type AreaPointPatch = z.output<typeof areaPointPatch>;
export type AreaRef = z.infer<typeof areaRef>;
export type AreaOption = z.infer<typeof areaOption>;
export type ModArea = z.infer<typeof modArea>;
