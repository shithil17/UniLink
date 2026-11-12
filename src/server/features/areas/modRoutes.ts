import { Hono, type Context } from "hono";
import type { z } from "zod";
import {
  areaHideRequest,
  areaInput,
  areaPatch,
  areaPointPatch,
  type modArea,
  type modAreaList,
} from "../../../shared/schemas/areas";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { areasRepo, type AreaRow } from "../../repos/areas";
import { validateJson } from "../../validate";
import { actorOf, paramId } from "../mod/respond";
import {
  addArea,
  renameArea,
  setAreaHidden,
  setAreaPoint,
  type AreaFailure,
  type AreaResult,
} from "./actions";

const FAILURES: Record<AreaFailure, { status: 400 | 404 | 409; message: string }> = {
  no_point_area: { status: 400, message: "Outside Dhaka has no place on the map." },
  not_found: { status: 404, message: "That area does not exist." },
  invalid_parent: {
    status: 400,
    message: "A sub-area needs a top-level area as its parent.",
  },
  name_taken: { status: 409, message: "Another area here already has that name." },
  already_hidden: { status: 409, message: "That area is already hidden." },
  not_hidden: { status: 409, message: "That area is not hidden." },
};

const toModArea = (a: AreaRow): z.infer<typeof modArea> => ({
  id: a.id,
  slug: a.slug,
  name: a.name,
  parentId: a.parentId,
  lat: a.lat,
  lng: a.lng,
  hidden: a.hidden,
  hiddenReason: a.hiddenReason,
});

function respond(c: Context, result: AreaResult, okStatus: 200 | 201 = 200) {
  if (result.ok) return c.json(toModArea(result.row), okStatus);
  const { status, message } = FAILURES[result.reason];
  return c.json({ error: result.reason, message }, status);
}

/** Every area write is rate limited per mod, checked before the action. */
async function writeAllowed(c: Context<AppEnv>) {
  const hit = await rateLimit(
    getDb(c.env.DB),
    `area:mod:${actorOf(c).id}`,
    limits.areaModWrite.limit,
    limits.areaModWrite.windowMs,
  );
  return hit.allowed ? null : rateLimitedResponse(c, hit);
}

/** Area management for mods and admins. Mounted under `/api/mod`, behind its role guard. */
export const areaModRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await areasRepo(getDb(c.env.DB)).listAll();
    return c.json(rows.map(toModArea) satisfies z.infer<typeof modAreaList>);
  })
  .post("/", validateJson(areaInput), async (c) => {
    const limited = await writeAllowed(c);
    if (limited) return limited;
    return respond(c, await addArea(getDb(c.env.DB), actorOf(c), c.req.valid("json")), 201);
  })
  .patch("/:id", validateJson(areaPatch), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const limited = await writeAllowed(c);
    if (limited) return limited;
    return respond(c, await renameArea(getDb(c.env.DB), actorOf(c), id, c.req.valid("json").name));
  })
  .put("/:id/point", validateJson(areaPointPatch), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const limited = await writeAllowed(c);
    if (limited) return limited;
    return respond(
      c,
      await setAreaPoint(getDb(c.env.DB), actorOf(c), id, c.req.valid("json").point),
    );
  })
  .post("/:id/hide", validateJson(areaHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const limited = await writeAllowed(c);
    if (limited) return limited;
    const { reason } = c.req.valid("json");
    return respond(c, await setAreaHidden(getDb(c.env.DB), actorOf(c), id, true, reason));
  })
  .post("/:id/unhide", validateJson(areaHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const limited = await writeAllowed(c);
    if (limited) return limited;
    const { reason } = c.req.valid("json");
    return respond(c, await setAreaHidden(getDb(c.env.DB), actorOf(c), id, false, reason));
  });
