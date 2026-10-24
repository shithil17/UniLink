export const HUES = ["mint", "sky", "lilac", "butter", "peach", "rose"] as const;

export type Hue = (typeof HUES)[number];

/** FNV-1a, 32-bit. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The hue a course wears, the same everywhere. A lab shares its theory course's hue (CSE225L
 * takes CSE225's).
 *
 * ceiling: two courses on the same day can share a hue. Every block prints its code, so nothing
 * depends on telling hues apart. Revisit only if the owner wants a user-pickable color.
 */
export function courseHue(code: string): Hue {
  let key = code.trim().toUpperCase();
  if (/\dL$/.test(key)) key = key.slice(0, -1);
  return HUES[fnv1a(key) % HUES.length];
}
