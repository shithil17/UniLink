import { prereqCourseCodes, type PrereqRule } from "./prereq.ts";

/*
 * Prerequisites as text, for the moderator's course editor and for showing a rule to students.
 *
 *   CSE215 and (MAT120 or MAT125)      "and" binds tighter than "or"
 *   120 credits completed              a degree-credits threshold ("credit" and "credits" both work)
 *
 * `formatPrereq` always puts a nested group in parentheses, so what it prints reads one way and
 * `parsePrereq(formatPrereq(rule))` gives the rule back. Only a rule that is not in its simplest
 * form changes on the way: a group with one member becomes that member, and an empty group is dropped
 * (see `simplifyPrereq`). Every rule in data/curricula is already simplest, so those round-trip as is.
 */

/** A rule without single-member or empty groups: what the text can express. */
export function simplifyPrereq(rule: PrereqRule | null | undefined): PrereqRule | null {
  if (!rule) return null;
  if ("course" in rule || "credits" in rule) return rule;
  const members = ("all" in rule ? rule.all : rule.any)
    .map(simplifyPrereq)
    .filter((r): r is PrereqRule => r !== null);
  if (members.length === 0) return null;
  if (members.length === 1) return members[0];
  return "all" in rule ? { all: members } : { any: members };
}

/** A rule as one readable line: `CSE115 and (MAT120 or MAT125)`. Empty when there is none. */
export function formatPrereq(rule: PrereqRule | null | undefined): string {
  const simple = simplifyPrereq(rule);
  return simple ? format(simple, false) : "";
}

function format(rule: PrereqRule, nested: boolean): string {
  if ("course" in rule) return rule.course;
  if ("credits" in rule) return `${String(rule.credits)} credits completed`;
  const isAll = "all" in rule;
  const members = (isAll ? rule.all : rule.any).map((r) => format(r, true));
  const joined = members.join(isAll ? " and " : " or ");
  return nested ? `(${joined})` : joined;
}

export type PrereqParse =
  | { ok: true; rule: PrereqRule | null }
  | {
      ok: false;
      message: string;
      /** Where in the text the problem starts (0-based). */ position: number;
    };

type Token =
  | { type: "course"; value: string; at: number }
  | { type: "number"; value: number; raw: string; at: number }
  | { type: "word"; value: string; at: number }
  | { type: "("; at: number }
  | { type: ")"; at: number }
  | { type: "end"; at: number };

const COURSE = /^[A-Za-z]{2,4}\d{3}[A-Za-z]?$/;

/** Splits the text into words, numbers, course codes and parentheses. Null with a message on a stray character. */
function tokenize(text: string): { tokens: Token[] } | { message: string; position: number } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "(" || ch === ")") {
      tokens.push({ type: ch, at: i });
      i++;
    } else if (/[A-Za-z0-9.]/.test(ch)) {
      let end = i;
      while (end < text.length && /[A-Za-z0-9.]/.test(text[end])) end++;
      const raw = text.slice(i, end);
      if (/^\d+(\.\d+)?$/.test(raw))
        tokens.push({ type: "number", value: Number(raw), raw, at: i });
      else if (COURSE.test(raw)) tokens.push({ type: "course", value: raw.toUpperCase(), at: i });
      else tokens.push({ type: "word", value: raw, at: i });
      i = end;
    } else {
      return {
        message: `"${ch}" isn't allowed here. Use course codes, "and", "or" and brackets.`,
        position: i,
      };
    }
  }
  tokens.push({ type: "end", at: text.length });
  return { tokens };
}

class ParseError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

const isWord = (t: Token, ...words: string[]) =>
  t.type === "word" && words.includes(t.value.toLowerCase());

const describe = (t: Token): string =>
  t.type === "end"
    ? "the end"
    : t.type === "("
      ? '"("'
      : t.type === ")"
        ? '")"'
        : t.type === "number"
          ? t.raw
          : t.value;

/**
 * Turns text into a rule. Empty text means no prerequisite (`rule: null`). A bad rule comes back
 * with a plain message and where it went wrong, ready to show under the field.
 */
export function parsePrereq(text: string): PrereqParse {
  const lexed = tokenize(text);
  if ("message" in lexed) return { ok: false, ...lexed };
  const { tokens } = lexed;
  if (tokens.length === 1) return { ok: true, rule: null };

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  /** `a or b or c`; "or" is the loosest. */
  function parseOr(): PrereqRule {
    const members = [parseAnd()];
    while (isWord(peek(), "or")) {
      next();
      members.push(parseAnd());
    }
    return members.length === 1 ? members[0] : { any: members };
  }

  /** `a and b and c`; "and" binds tighter than "or". */
  function parseAnd(): PrereqRule {
    const members = [parseAtom()];
    while (isWord(peek(), "and")) {
      next();
      members.push(parseAtom());
    }
    return members.length === 1 ? members[0] : { all: members };
  }

  function parseAtom(): PrereqRule {
    const t = next();
    if (t.type === "course") return { course: t.value };
    if (t.type === "(") {
      if (peek().type === ")")
        throw new ParseError("Put a course or a rule between the brackets.", t.at);
      const inner = parseOr();
      const close = next();
      if (close.type !== ")") {
        throw new ParseError(
          close.type === "end"
            ? 'A bracket is not closed. Add ")" at the end.'
            : `Expected ")" but found ${describe(close)}.`,
          close.at,
        );
      }
      return inner;
    }
    if (t.type === "number") {
      if (t.value <= 0) throw new ParseError("Credits must be more than 0.", t.at);
      if (!isWord(peek(), "credit", "credits")) {
        throw new ParseError(
          `Write ${t.raw} credits completed, or a course code like CSE215.`,
          t.at,
        );
      }
      next();
      if (isWord(peek(), "completed")) next();
      return { credits: t.value };
    }
    if (t.type === "word") {
      if (isWord(t, "and", "or")) {
        throw new ParseError(`"${t.value}" needs a course on both sides.`, t.at);
      }
      throw new ParseError(`"${t.value}" isn't a course code. Codes look like CSE215.`, t.at);
    }
    if (t.type === ")") throw new ParseError('There is a ")" without a matching "(".', t.at);
    throw new ParseError("The rule ends too early. Add a course after the last and/or.", t.at);
  }

  try {
    const rule = parseOr();
    const rest = peek();
    if (rest.type !== "end") {
      throw new ParseError(
        rest.type === ")"
          ? 'There is a ")" without a matching "(".'
          : `Put "and" or "or" before ${describe(rest)}.`,
        rest.at,
      );
    }
    return { ok: true, rule };
  } catch (err) {
    if (err instanceof ParseError)
      return { ok: false, message: err.message, position: err.position };
    throw err;
  }
}

/**
 * The course codes a rule uses that are not in `known`, in order, once each. A prerequisite on a
 * code nobody can pass would lock the course for good, so the editor refuses it.
 */
export function unknownPrereqCodes(
  rule: PrereqRule | null | undefined,
  known: ReadonlySet<string>,
): string[] {
  return [...new Set(prereqCourseCodes(rule).filter((c) => !known.has(c)))];
}
