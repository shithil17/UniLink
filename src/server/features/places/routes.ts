import { Hono } from "hono";
import { inBounds, MAP_BOUNDS } from "../../../shared/geo";
import { placeSearchQuery, type PlaceSearchResponse } from "../../../shared/schemas/places";
import { photonGeocoder } from "../../adapters/geocoder";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv, SessionUser } from "../../middleware/types";
import { validateQuery } from "../../validate";

/**
 * Place search for the pin picker. Login required and rate limited per user before the geocoder is
 * called. The geocoder is asked for the typed text inside `MAP_BOUNDS` and nothing else, so it learns
 * nothing about the student; the Worker makes the call, so it never sees their IP address. A failure,
 * a timeout or a throttled answer is a 502 `search_unavailable`; the client then shows areas alone.
 *
 * ceiling: no server-side result cache. Students search only while posting a ride, a few queries at a
 * time. Revisit if Photon throttles us.
 */
export const placeRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/search", validateQuery(placeSearchQuery), async (c) => {
    const me = c.get("user") as SessionUser;
    const { q } = c.req.valid("query");
    const { rateLimit: cap } = limits.placeSearch;
    const hit = await rateLimit(getDb(c.env.DB), `places:search:${me.id}`, cap.limit, cap.windowMs);
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const geocoder = c.get("geocoder") ?? photonGeocoder();
    try {
      const found = await geocoder.search(
        q,
        MAP_BOUNDS,
        AbortSignal.timeout(limits.placeSearch.timeoutMs),
      );
      const places = found.filter((p) => inBounds(p)).slice(0, limits.placeSearch.maxResults);
      return c.json({ places } satisfies PlaceSearchResponse);
    } catch {
      return c.json({ error: "search_unavailable" }, 502);
    }
  });
