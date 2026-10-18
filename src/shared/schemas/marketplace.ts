import { z } from "zod";
import { contacts, id, postStatus } from "./common";

export const listingCategory = z.enum([
  "books",
  "electronics",
  "calculators_and_lab_gear",
  "room_and_furniture",
  "clothing",
  "other",
]);
export const listingCondition = z.enum(["new", "like_new", "good", "fair"]);

export const listingInput = z.object({
  title: z.string(),
  category: listingCategory,
  description: z.string(),
  condition: listingCondition,
  /** Taka; 0 means free. */
  priceTaka: z.number().int().nonnegative(),
  negotiable: z.boolean(),
  pickupArea: z.string(),
  contacts,
});

/** Feed item: no contact details. */
export const listingSummary = listingInput
  .omit({ contacts: true })
  .extend({ id, status: postStatus, sold: z.boolean() });
