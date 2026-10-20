import type { z } from "zod";
import type { reasonCategory } from "../../shared/schemas/common";
import type { ruleName } from "../../shared/schemas/moderation";

const CATEGORY_LABELS: Record<z.infer<typeof reasonCategory>, string> = {
  prohibited_item: "Prohibited item",
  personal_data: "Personal data",
  scam_or_spam: "Scam or spam",
  abuse_or_harassment: "Abuse or harassment",
  off_topic: "Off topic",
  fine: "No issue found",
};

const RULE_LABELS: Record<z.infer<typeof ruleName>, string> = {
  student_id: "Student ID",
  card_number: "Card number",
  url: "Link",
  contact_format: "Contact details",
  length: "Length",
  banned_word: "Banned word",
  image: "Image",
};

/** Mod-facing words for a screening category. */
export const categoryLabel = (c: z.infer<typeof reasonCategory>) => CATEGORY_LABELS[c];

/** Mod-facing words for a rule that fired. */
export const ruleLabel = (r: z.infer<typeof ruleName>) => RULE_LABELS[r];

/** "64%" for a 0 to 1 confidence, or null when the model gave none. */
export function confidenceLabel(confidence: number | null): string | null {
  return confidence === null ? null : `${Math.round(confidence * 100)}%`;
}

/** A post type key as words: "lost_found" becomes "lost found". */
export const postTypeLabel = (targetType: string) => targetType.replaceAll("_", " ");
