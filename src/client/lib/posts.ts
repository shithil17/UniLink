import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AUTHOR_DELETE_PURGE_MS } from "../../shared/posts";
import { contactReveal, type reportTargetType } from "../../shared/schemas/common";
import { reportCreated } from "../../shared/schemas/moderation";
import { apiDelete, apiGet, apiPost } from "./api";
import type { ConfirmRequest } from "./modConfirm";
import { durationWords } from "./resources";

// Client side of the shared post kit: what every post type's screens use for reporting, appealing a
// rejection, revealing contacts and deleting one's own post.

/** What a report can point at, other than a user. Each post type adds its value to `reportTargetType`. */
export type PostTargetType = Exclude<z.infer<typeof reportTargetType>, "user">;

const ok = z.object({ ok: z.boolean() });

export function useReport() {
  return useMutation({
    mutationFn: (input: { targetType: PostTargetType; targetId: number; reason: string }) =>
      apiPost("/api/reports", reportCreated, input),
  });
}

/**
 * "Ask a moderator to look": sends the author's own rejected post to the queue. The post's status
 * changes, so every query refreshes.
 */
export function useAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: { targetType: PostTargetType; id: number }) =>
      apiPost(`/api/posts/${post.targetType}/${post.id}/appeal`, ok),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * Shows a post's contacts. A mutation, not a query: each reveal is counted against the user's limit, so
 * it only runs when they tap. `basePath` is the type's API path, such as `/api/rides`.
 */
export function useRevealContact(basePath: `/api/${string}`) {
  return useMutation({
    mutationFn: (id: number) => apiGet(`${basePath}/${id}/contact`, contactReveal),
  });
}

/**
 * Deletes the author's own post at `DELETE <basePath>/:id` and refreshes every query (feeds, mine,
 * other posts). The deleted post's own detail query (keyed `[type, "detail", id]`) is left alone:
 * asking for it again would only 404 and flash "not available" on the detail that is closing.
 */
export function useDeletePost(basePath: `/api/${string}`) {
  const queryClient = useQueryClient();
  // "/api/rides" is the "rides" in query keys. Only that type's detail is skipped: another type's
  // post can have the same id.
  const type = basePath.split("/")[2];
  return useMutation({
    mutationFn: (id: number) => apiDelete(`${basePath}/${id}`, ok),
    onSuccess: (_, id) =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          !(queryKey[0] === type && queryKey[1] === "detail" && queryKey[2] === id),
      }),
  });
}

/** What the confirm sheet says before an author deletes their own post. Built from the server's purge window. */
export function deletePostConfirm(what: string, run: () => Promise<unknown>): ConfirmRequest {
  return {
    title: `Delete this ${what}`,
    confirmLabel: "Delete",
    destructive: true,
    lead: `Your ${what} disappears for everyone right away.`,
    facts: [],
    effects: [
      "You can't bring it back.",
      `It is removed for good after ${durationWords(AUTHOR_DELETE_PURGE_MS)}, or later if a report on it is still open.`,
    ],
    run,
  };
}
