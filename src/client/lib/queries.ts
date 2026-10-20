import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { attempt, cgpaSummary } from "../../shared/schemas/attempts";
import { me } from "../../shared/schemas/auth";
import { courseMap } from "../../shared/schemas/courses";
import { facultyOption } from "../../shared/schemas/faculty";
import { healthResponse } from "../../shared/schemas/health";
import { notificationPage, unreadCount } from "../../shared/schemas/inbox";
import { routineEntry } from "../../shared/schemas/routine";
import { z } from "zod";
import { ApiError, apiGet } from "./api";
import { INBOX_POLL_MS } from "./inbox";
import { fetchPublicKey, readPushState } from "./push";

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

/** The signed-in student's course map. Recording a grade or editing a course invalidates it. */
export const courseMapQuery = queryOptions({
  queryKey: ["course-map"],
  queryFn: () => apiGet("/api/courses/map", courseMap),
});

/** The signed-in user's unread count for the nav badge. Marking read invalidates the `inbox` prefix. */
export const unreadCountQuery = queryOptions({
  queryKey: ["inbox", "unread-count"],
  queryFn: () => apiGet("/api/inbox/unread-count", unreadCount),
  refetchInterval: INBOX_POLL_MS,
  refetchOnWindowFocus: true,
});

/** The inbox, newest first, one cursor page at a time. */
export const inboxQuery = infiniteQueryOptions({
  queryKey: ["inbox", "list"],
  queryFn: ({ pageParam }) =>
    apiGet(
      pageParam ? `/api/inbox?cursor=${encodeURIComponent(pageParam)}` : "/api/inbox",
      notificationPage,
    ),
  initialPageParam: "",
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

/** The server's VAPID public key, or null while web push is not configured (the switch is hidden). */
export const pushPublicKeyQuery = queryOptions({
  queryKey: ["push", "public-key"],
  queryFn: fetchPublicKey,
  staleTime: Infinity,
});

/** This device's push state, read from the browser. Turning the switch on or off invalidates it. */
export const pushStateQuery = queryOptions({
  queryKey: ["push", "state"],
  queryFn: readPushState,
  // The browser is the source of truth, and the user can change the permission in its settings.
  staleTime: 0,
  refetchOnWindowFocus: true,
});

/** Every attempt the student has recorded, oldest first. Any attempt change invalidates the `attempts` prefix. */
export const attemptsQuery = queryOptions({
  queryKey: ["attempts", "list"],
  queryFn: () => apiGet("/api/attempts", z.array(attempt)),
});

/** CGPA, graded and earned credits and what is left per category. */
export const cgpaSummaryQuery = queryOptions({
  queryKey: ["attempts", "summary"],
  queryFn: () => apiGet("/api/attempts/summary", cgpaSummary),
});

/** The faculty list for the picker. It changes rarely, so it is kept for the session. */
export const facultyQuery = queryOptions({
  queryKey: ["faculty"],
  queryFn: () => apiGet("/api/faculty", z.array(facultyOption)),
  staleTime: Infinity,
});

/** The signed-in student's classes for the current term. Any routine write invalidates the `routine` prefix. */
export const routineQuery = queryOptions({
  queryKey: ["routine", "list"],
  queryFn: () => apiGet("/api/routine", z.array(routineEntry)),
});
