import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  PLACE_QUERY_MIN_LENGTH,
  PLACE_SEARCH_DEBOUNCE_MS,
  placeSearchResponse,
} from "../../shared/schemas/places";
import { apiGet, queryString } from "./api";

// ceiling: a place's name and point do not change within a posting session, so a repeated search (backspacing over a word) answers from memory instead of costing a request and a share of the geocoder's fair use. Five minutes; revisit if students see stale places.
const PLACE_SEARCH_STALE_MS = 5 * 60_000;

/** Places for `q`. The signal cancels the request when a newer search replaces it. */
export const placeSearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: ["places", q],
    queryFn: ({ signal }) =>
      apiGet(`/api/places/search${queryString({ q })}`, placeSearchResponse, signal),
    staleTime: PLACE_SEARCH_STALE_MS,
    // The server answers 502 when the geocoder is down; a retry would only repeat the request.
    retry: false,
  });

/** `value`, but only after it has stayed the same for `delayMs`. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * Place search as the student types. Asks only once the text has stayed put for `debounceMs` and
 * reached the minimum length; a newer text cancels the request it replaces, and the last answer stays
 * on screen until the new one arrives.
 */
export function usePlaceSearch(text: string, debounceMs: number = PLACE_SEARCH_DEBOUNCE_MS) {
  const q = useDebounced(text.trim(), debounceMs);
  const enabled = q.length >= PLACE_QUERY_MIN_LENGTH;
  const query = useQuery({
    ...placeSearchQueryOptions(q),
    enabled,
    placeholderData: keepPreviousData,
  });
  return {
    /** The text the shown places answer, once it is long enough to search. */
    enabled,
    places: enabled ? (query.data?.places ?? []) : [],
    /** A search is in flight, or the text is waiting out its pause. */
    pending:
      text.trim().length >= PLACE_QUERY_MIN_LENGTH && (q !== text.trim() || query.isFetching),
    failed: enabled && query.isError,
    /** A real answer for the text (not a placeholder from the one before). */
    answered: enabled && query.isSuccess && !query.isPlaceholderData,
  };
}
