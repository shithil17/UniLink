import { z } from "zod";
import { contacts, id, postStatus } from "./common";

export const lostFoundType = z.enum(["lost", "found"]);
export const lostFoundCategory = z.enum([
  "id_or_card",
  "wallet",
  "phone",
  "laptop_or_charger",
  "bag",
  "keys",
  "books_or_notes",
  "other",
]);

export const lostFoundInput = z.object({
  type: lostFoundType,
  title: z.string(),
  category: lostFoundCategory,
  description: z.string(),
  place: z.string(),
  date: z.string(),
  contacts,
  /** Found posts only. Visible to the poster alone. */
  verificationDetail: z.string().optional(),
});

/** Feed item: no contacts and never the verification detail. */
export const lostFoundSummary = lostFoundInput
  .omit({ contacts: true, verificationDetail: true })
  .extend({ id, status: postStatus, resolved: z.boolean() });
