import { useEffect, useState } from "react";

// ceiling: a typist pauses a beat between words; a quarter second waits out the keystrokes of one word
// without making the list feel slow. Shared by every search box that asks the server. Revisit if
// searches feel sluggish or the API sees too many requests.
export const SEARCH_DEBOUNCE_MS = 250;

/** `value`, but only after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
