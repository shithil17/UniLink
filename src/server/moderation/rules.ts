import type { z } from "zod";
import { badContactKinds, type ContactKind } from "../../shared/contact.ts";
import type { reasonCategory } from "../../shared/schemas/common.ts";
import type { ruleName } from "../../shared/schemas/moderation.ts";
import { NSU_PROGRAM_CODES, STUDENT_ID_PATTERN } from "../../shared/studentId.ts";
import { parseWebp } from "../../shared/webp.ts";
import { limits } from "../limits";
import { BANNED_WORDS, LINK_TLDS, URL_ALLOWLIST } from "./data";

export type ReasonCategory = z.infer<typeof reasonCategory>;
export type RuleName = z.infer<typeof ruleName>;

/** One thing the rules found. Never carries the matched text, so a flag is safe to store and show to mods. */
export type RuleFlag = {
  rule: RuleName;
  category: ReasonCategory;
  /** Index of the text field (or image) it was found in, when that helps a mod. */
  index?: number;
};

export type RuleInput = {
  /** The screened text fields (title, description, place, notes). */
  texts: readonly string[];
  /** WebP bytes. */
  images?: readonly Uint8Array[];
  /** Checked for format only. Never sent to the model. */
  contacts?: Partial<Record<ContactKind, string | undefined>>;
};

export type RuleResult = {
  flags: RuleFlag[];
  /** The category to reject under: the most serious flag. `fine` when nothing was flagged. */
  category: ReasonCategory;
  /** The screened text with student IDs and card numbers blanked, safe for an audit snapshot. */
  redactedText: string;
};

// Most serious first: personal data outranks everything because it cannot be taken back once posted.
const CATEGORY_ORDER: readonly ReasonCategory[] = [
  "personal_data",
  "prohibited_item",
  "scam_or_spam",
  "abuse_or_harassment",
  "off_topic",
];

const REDACTED = "[redacted]";

// ---- Digits: student IDs and card numbers --------------------------------------------------

type Group = { digits: string; start: number; end: number };

/** Bangla digits to ASCII, one character for one, so match positions still line up with the original. */
function asciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x09e6 + 48));
}

/**
 * Digit groups in order, merged into runs where only spaces, tabs or dashes sit between them, so
 * "221 2345-042" is one run of three groups. Anything else (a letter, a comma, a newline) ends the run.
 */
function digitRuns(text: string): Group[][] {
  const runs: Group[][] = [];
  let run: Group[] = [];
  let previousEnd = -1;
  for (const m of asciiDigits(text).matchAll(/\d+/g)) {
    const group = { digits: m[0], start: m.index, end: m.index + m[0].length };
    const gap = text.slice(previousEnd, group.start);
    if (run.length > 0 && !/^[ \t -]+$/.test(gap)) {
      runs.push(run);
      run = [];
    }
    run.push(group);
    previousEnd = group.end;
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** A Bangladeshi mobile number with or without +880 / 0: 01X-XXXXXXXX. */
function isBdPhone(digits: string): boolean {
  return /^(?:880)?0?1[3-9]\d{8}$/.test(digits);
}

/** Luhn check over a digit string. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function looksLikeStudentId(digits: string): boolean {
  const m = STUDENT_ID_PATTERN.exec(digits);
  // The year is not checked: a graduate's ID is still personal data.
  return m !== null && Object.hasOwn(NSU_PROGRAM_CODES, m[3]);
}

/** Written as a card is: one block, 4-4-4-4 (the last may be shorter), 4-6-5 or 4-6-4. */
function hasCardGrouping(lengths: number[]): boolean {
  if (lengths.length === 1) return true;
  const last = lengths[lengths.length - 1];
  const head = lengths.slice(0, -1);
  if (head.every((n) => n === 4) && last >= 1 && last <= 4) return true;
  return lengths.length === 3 && lengths[0] === 4 && lengths[1] === 6 && (last === 5 || last === 4);
}

const CARD_MIN_DIGITS = 13;
const CARD_MAX_DIGITS = 19;
const STUDENT_ID_DIGITS = 10;

/** True when groups `i..j`, or the one or two groups just before them, spell a Bangladeshi phone number. */
function isPhoneWindow(run: Group[], i: number, j: number): boolean {
  for (let k = Math.max(0, i - 2); k <= i; k++) {
    if (
      isBdPhone(
        run
          .slice(k, j + 1)
          .map((g) => g.digits)
          .join(""),
      )
    )
      return true;
  }
  return false;
}

/** Student IDs and card numbers, with the character spans to blank in a snapshot. */
function scanDigits(text: string, flags: RuleFlag[], spans: [number, number][], index: number) {
  for (const run of digitRuns(text)) {
    for (let i = 0; i < run.length; i++) {
      let digits = "";
      let hasPhoneGroup = false;
      for (let j = i; j < run.length && j - i < limits.screen.digitGroupsMax; j++) {
        digits += run[j].digits;
        hasPhoneGroup ||= isBdPhone(run[j].digits);
        if (digits.length > CARD_MAX_DIGITS) break;
        // "+880 1712 345670" must not leave "1712 345670" to be read as an ID or a card.
        if (isPhoneWindow(run, i, j)) continue;
        const span: [number, number] = [run[i].start, run[j].end];
        if (digits.length === STUDENT_ID_DIGITS && looksLikeStudentId(digits)) {
          flags.push({ rule: "student_id", category: "personal_data", index });
          spans.push(span);
        } else if (
          digits.length >= CARD_MIN_DIGITS &&
          // A phone number in the text is not a card, and neither is a phone number plus a few digits.
          !hasPhoneGroup &&
          hasCardGrouping(run.slice(i, j + 1).map((g) => g.digits.length)) &&
          passesLuhn(digits)
        ) {
          flags.push({ rule: "card_number", category: "personal_data", index });
          spans.push(span);
        }
      }
    }
  }
}

function redact(text: string, spans: [number, number][]): string {
  const ordered = [...spans].sort((a, b) => a[0] - b[0]);
  let out = "";
  let at = 0;
  for (const [start, end] of ordered) {
    if (end <= at) continue;
    out += text.slice(at, Math.max(start, at)) + REDACTED;
    at = end;
  }
  return out + text.slice(at);
}

// ---- URLs ----------------------------------------------------------------------------------

const SCHEME_URL = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function bareDomains(): RegExp {
  return new RegExp(
    `(?<![\\w@.-])(?:[a-z0-9-]+\\.)+(?:${LINK_TLDS.join("|")})(?![\\w-])(?:[/?#][^\\s<>"')\\]]*)?`,
    "gi",
  );
}

function hostOf(raw: string): string | null {
  const cleaned = raw.replace(TRAILING_PUNCTUATION, "");
  try {
    return new URL(
      /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`,
    ).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** A host is allowed if it is, or is a subdomain of, an allowlisted host. `a.com.evil.io` is not. */
export function isAllowedHost(host: string): boolean {
  return URL_ALLOWLIST.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function hasDisallowedUrl(text: string): boolean {
  const found = [...text.matchAll(SCHEME_URL), ...text.matchAll(bareDomains())];
  return found.some((m) => {
    const host = hostOf(m[0]);
    // An unparseable link is held back too: it is not one we can vouch for.
    return host === null || !isAllowedHost(host);
  });
}

// ---- Banned words --------------------------------------------------------------------------

/** Lowercase, NFKC and no zero-width characters, so a word split by invisible characters or typed in full-width letters still matches. */
function normalizeForWords(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‍⁠﻿]/g, "");
}

const bannedMatchers = BANNED_WORDS.map(({ term, category }) => ({
  category,
  // Unicode-aware word edges: \b does not understand Bangla script.
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}])`, "u"),
}));

// ---- Images --------------------------------------------------------------------------------

function imageFlags(images: readonly Uint8Array[]): RuleFlag[] {
  const flags: RuleFlag[] = [];
  if (images.length > limits.screen.imagesMax) flags.push({ rule: "image", category: "off_topic" });
  images.forEach((bytes, index) => {
    if (bytes.length > limits.screen.imageMaxBytes) {
      flags.push({ rule: "image", category: "off_topic", index });
      return;
    }
    const webp = parseWebp(bytes);
    if (!webp.ok) {
      flags.push({ rule: "image", category: "off_topic", index });
      return;
    }
    const side = limits.screen.imageMaxSidePx;
    if (webp.width < 1 || webp.height < 1 || webp.width > side || webp.height > side) {
      flags.push({ rule: "image", category: "off_topic", index });
    }
    // Metadata can hold GPS coordinates and the camera owner's name.
    if (webp.hasExif || webp.hasXmp)
      flags.push({ rule: "image", category: "personal_data", index });
  });
  return flags;
}

// ---- The rules step ------------------------------------------------------------------------

/**
 * The deterministic rules. No network, no AI, no state. Any flag is a clear rule violation: `screen()`
 * rejects without calling the model. Contact format and length are checked here too so a request that
 * skipped the client form still cannot get a bad value through.
 */
export function runRules(input: RuleInput): RuleResult {
  const flags: RuleFlag[] = [];
  const redactedFields: string[] = [];

  input.texts.forEach((text, index) => {
    if (text.length > limits.screen.textMaxLength) {
      // Over-long text is rejected on length alone: the other scans are skipped so a huge body stays cheap.
      flags.push({ rule: "length", category: "off_topic", index });
      redactedFields.push("[text too long]");
      return;
    }

    const spans: [number, number][] = [];
    scanDigits(text, flags, spans, index);
    redactedFields.push(redact(text, spans));

    if (hasDisallowedUrl(text)) flags.push({ rule: "url", category: "scam_or_spam", index });

    const normalized = normalizeForWords(text);
    for (const { category, pattern } of bannedMatchers) {
      if (pattern.test(normalized)) flags.push({ rule: "banned_word", category, index });
    }
  });

  if (input.contacts && badContactKinds(input.contacts).length > 0) {
    flags.push({ rule: "contact_format", category: "scam_or_spam" });
  }
  flags.push(...imageFlags(input.images ?? []));

  // Overlapping digit windows and the two URL patterns can find the same thing twice.
  const unique = [
    ...new Map(flags.map((f) => [`${f.rule}:${f.category}:${f.index ?? ""}`, f])).values(),
  ];
  const category = CATEGORY_ORDER.find((c) => unique.some((f) => f.category === c)) ?? "fine";
  return { flags: unique, category, redactedText: redactedFields.join("\n") };
}
