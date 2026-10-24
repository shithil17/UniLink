// How the faculty directory reads a search, shared by the server (which runs it) and the row labels.

type Named = { name: string; initials: string | null };

/** Honorifics people type or NSU prints before a name. "Md." and "Mohammad" are parts of names and stay. */
const TITLES: ReadonlySet<string> = new Set(["dr", "prof", "mr", "mrs", "ms", "engr"]);

/** Lowercase, no diacritics, anything that is not a letter or digit becomes a space. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a name or query, with honorific titles dropped. */
export function normalizeWords(text: string): string[] {
  return fold(text)
    .split(" ")
    .filter((w) => w !== "" && !TITLES.has(w));
}

/** "Name (INIT)", or just the name when there are no initials or the name already carries them. */
export function facultyTitle(f: Named): string {
  if (!f.initials) return f.name;
  return f.name.toLowerCase().includes(`(${f.initials.toLowerCase()})`)
    ? f.name
    : `${f.name} (${f.initials})`;
}

/**
 * How a typed search reads. A name matches when every word starts a word of it; initials match when
 * they equal or start with `initials` (the query without spaces). The server ranks exact initials,
 * then initials prefixes, then names, each group by name.
 */
export function parseFacultyQuery(query: string): { words: string[]; initials: string } {
  return { words: normalizeWords(query), initials: fold(query).replaceAll(" ", "") };
}
