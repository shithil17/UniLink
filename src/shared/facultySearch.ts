// Search and filter over the faculty directory, shared by the student picker and the moderator panel.
// The whole directory is loaded once, so this runs in the browser over that list.

export type SearchableFaculty = {
  name: string;
  initials: string | null;
  department: string;
  hidden?: boolean;
};

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
export function facultyTitle(f: Pick<SearchableFaculty, "name" | "initials">): string {
  if (!f.initials) return f.name;
  return f.name.toLowerCase().includes(`(${f.initials.toLowerCase()})`)
    ? f.name
    : `${f.name} (${f.initials})`;
}

// Lower is better.
const EXACT_INITIALS = 0;
const INITIALS_PREFIX = 1;
const NAME_WORDS = 2;

function rank(
  f: SearchableFaculty,
  words: readonly string[],
  initialsQuery: string,
): number | null {
  const initials = f.initials?.toLowerCase() ?? null;
  if (initials !== null && initialsQuery !== "") {
    if (initials === initialsQuery) return EXACT_INITIALS;
    if (initials.startsWith(initialsQuery)) return INITIALS_PREFIX;
  }
  if (words.length === 0) return NAME_WORDS;
  const nameWords = normalizeWords(f.name);
  return words.every((w) => nameWords.some((n) => n.startsWith(w))) ? NAME_WORDS : null;
}

export type FacultyFilter = {
  query?: string;
  /** A department code; null or undefined means all. */
  department?: string | null;
  /** The moderator panel shows hidden rows when asked; the picker never does. */
  includeHidden?: boolean;
};

/**
 * A query matches when every word of it starts a word of the name, or when it starts the initials.
 * Results: exact initials, then initials prefixes, then name matches; each group by name.
 */
export function searchFaculty<T extends SearchableFaculty>(
  list: readonly T[],
  { query = "", department = null, includeHidden = false }: FacultyFilter = {},
): T[] {
  const words = normalizeWords(query);
  const initialsQuery = fold(query).replaceAll(" ", "");
  return list
    .filter(
      (f) => (includeHidden || !f.hidden) && (department === null || f.department === department),
    )
    .flatMap((f) => {
      const r = rank(f, words, initialsQuery);
      return r === null ? [] : [{ f, r }];
    })
    .sort((a, b) => a.r - b.r || a.f.name.localeCompare(b.f.name))
    .map(({ f }) => f);
}
