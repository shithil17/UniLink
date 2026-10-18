import { z } from "zod";

// Shapes reused across modules. Stubs: each owning phase tightens its own schemas.

export const id = z.coerce.number().int().positive();

/** UTC epoch milliseconds. */
export const instant = z.number().int().nonnegative();

export const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const termSeason = z.enum(["spring", "summer", "fall"]);
export const term = z.object({ year: z.number().int(), season: termSeason });

export const postStatus = z.enum(["published", "pending_review", "rejected"]);

export const reasonCategory = z.enum([
  "prohibited_item",
  "personal_data",
  "scam_or_spam",
  "abuse_or_harassment",
  "off_topic",
  "fine",
]);

export const reportTargetType = z.enum([
  "resource_request",
  "resource_submission",
  "faculty",
  "ride",
  "lost_found",
  "listing",
]);

/** Contact details; only ever returned by the per-post contact endpoint, never in feeds. */
export const contacts = z.object({
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  messenger: z.string().optional(),
});

export const apiError = z.object({ error: z.string() });
