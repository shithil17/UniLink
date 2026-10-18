import { queryOptions } from "@tanstack/react-query";
import { me } from "../../shared/schemas/auth";
import { healthResponse } from "../../shared/schemas/health";
import { ApiError, apiGet } from "./api";

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: () => apiGet("/api/health", healthResponse),
});

/** The signed-in user, or null when signed out. */
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    try {
      return await apiGet("/api/auth/me", me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  // The cookie decides who is signed in; stale data here could send a user to the wrong screen.
  staleTime: 0,
});
