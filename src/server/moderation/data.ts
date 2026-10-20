import type { z } from "zod";
import type { reasonCategory } from "../../shared/schemas/common.ts";

type Category = z.infer<typeof reasonCategory>;

// Starting values for the deterministic rules. Mods and the calibration set will grow both lists;
// a change here is a data change, not a logic change.

/**
 * Hosts a post may link to. A host matches itself and any subdomain of it. Everything else is held back
 * as a possible scam or tracking link. The resource-sharing allowlist (Drive and similar) is separate.
 */
export const URL_ALLOWLIST: readonly string[] = [
  "northsouth.edu",
  "nsu.edu",
  "google.com",
  "forms.gle",
  "youtube.com",
  "youtu.be",
  "github.com",
  "wikipedia.org",
  "facebook.com",
  "fb.com",
  "m.me",
  "wa.me",
];

/** Top-level domains that make a bare "example.xyz" count as a link when the text has no scheme. */
export const LINK_TLDS: readonly string[] = [
  "com",
  "net",
  "org",
  "edu",
  "io",
  "me",
  "co",
  "ly",
  "xyz",
  "info",
  "biz",
  "app",
  "link",
  "site",
  "online",
  "shop",
  "top",
  "bd",
  "gle",
  "gl",
];

export type BannedWord = { term: string; category: Category };

/**
 * Whole words and phrases, compared case-insensitively. English and Banglish for now; Bangla-script
 * entries are added from the calibration set. Wording here is blunt on purpose: these are matched, never shown.
 */
export const BANNED_WORDS: readonly BannedWord[] = [
  { term: "yaba", category: "prohibited_item" },
  { term: "phensedyl", category: "prohibited_item" },
  { term: "cocaine", category: "prohibited_item" },
  { term: "heroin", category: "prohibited_item" },
  { term: "ganja", category: "prohibited_item" },
  { term: "marijuana", category: "prohibited_item" },
  { term: "firearm", category: "prohibited_item" },
  { term: "fake certificate", category: "prohibited_item" },
  { term: "fake id", category: "prohibited_item" },
  { term: "leaked question", category: "prohibited_item" },
  { term: "exam paper leak", category: "prohibited_item" },
  { term: "double your money", category: "scam_or_spam" },
  { term: "guaranteed profit", category: "scam_or_spam" },
  { term: "easy money", category: "scam_or_spam" },
  { term: "send bkash first", category: "scam_or_spam" },
  { term: "advance payment only", category: "scam_or_spam" },
  { term: "kill yourself", category: "abuse_or_harassment" },
  { term: "kys", category: "abuse_or_harassment" },
];
