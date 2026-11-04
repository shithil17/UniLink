import { NSU_SCALE } from "../../shared/grading";

/** Mock grades by row key, as picked on the planner. */
export type MockPicks = Record<string, string>;

/** The grades a mock may use: the letter grades of the NSU scale, best first (no I, W or WV). */
export const MOCK_GRADES: readonly string[] = Object.entries(NSU_SCALE.points)
  .sort((a, b) => b[1] - a[1])
  .map(([grade]) => grade);

/**
 * Where one student's mock grades live on this device: per user and curriculum version, so a new
 * curriculum starts clean. Keyed by username, the only stable user label the client has.
 */
export function mocksStorageKey(username: string, curriculumVersion: string): string {
  return `unilink-planner-mocks:${username}:${curriculumVersion}`;
}

/** The saved picks, or none when storage is missing, blocked or holds something unexpected. */
export function loadMocks(key: string): MockPicks {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const picks: MockPicks = {};
    for (const [row, grade] of Object.entries(parsed)) {
      if (typeof grade === "string" && MOCK_GRADES.includes(grade)) picks[row] = grade;
    }
    return picks;
  } catch {
    return {};
  }
}

/** Saves the picks; an empty set removes the entry. Storage that is full or blocked is ignored. */
export function saveMocks(key: string, picks: MockPicks): void {
  try {
    if (Object.keys(picks).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(picks));
  } catch {
    // Mocks are a convenience kept on this device only: a failed save just means they don't persist.
  }
}
