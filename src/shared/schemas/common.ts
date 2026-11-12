import { z } from "zod";
import {
  CONTACT_MAX_LENGTH,
  CONTACT_MESSAGES,
  CONTACT_REQUIRED_MESSAGE,
  CONTACT_TOO_LONG_MESSAGE,
  hasContact,
  isValidContact,
  type ContactKind,
} from "../contact";

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

/** What a report can point at. Each post type adds one value here when it ships. */
export const reportTargetType = z.enum(["user", "resource_request", "resource_submission"]);

/**
 * The report targets a mod can remove from the queue: the ones with a table in `softDeleteTargets`
 * (a user is banned from the Users screen instead). Shared so the queue only offers Remove where the
 * server will take it; a test keeps this list and `softDeleteTargets` in step.
 */
export const removableReportTargets: readonly z.infer<typeof reportTargetType>[] = [
  "resource_request",
  "resource_submission",
];

/** One contact field: trimmed, blank becomes absent, anything left must match its kind's format. */
const contactField = (kind: ContactKind) =>
  z
    .string()
    .trim()
    .max(CONTACT_MAX_LENGTH, CONTACT_TOO_LONG_MESSAGE)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || isValidContact(kind, v), CONTACT_MESSAGES[kind]);

/**
 * Contact details for a post: at least one of phone, WhatsApp link and Messenger or Facebook link, each
 * in its own format (see `src/shared/contact.ts`). Only ever returned by the per-post contact endpoint,
 * never in feeds. "At least one" is reported against `phone`, the first field, so a form can show it.
 */
export const contacts = z
  .object({
    phone: contactField("phone"),
    whatsapp: contactField("whatsapp"),
    messenger: contactField("messenger"),
  })
  .refine(hasContact, { message: CONTACT_REQUIRED_MESSAGE, path: ["phone"] });

export type Contacts = z.output<typeof contacts>;
/** What a contact form holds while it is being filled in: the strings as typed. */
export type ContactsFormValues = z.input<typeof contacts>;

/** The answer of `GET /api/<type>/:id/contact`: the contacts and nothing else. */
export const contactReveal = z.object({ contacts });

/** `error` is a stable code; `message` is safe to show the user when present. */
export const apiError = z.object({ error: z.string(), message: z.string().optional() });
