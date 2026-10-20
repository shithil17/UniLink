import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  auditPage,
  idConflictResult,
  modQueuePage,
  modReportPage,
  modUserPage,
  reverseResult,
  temporaryPassword,
} from "../../shared/schemas/moderation";
import type { rejectCategory } from "../../shared/schemas/moderation";
import { apiGet, apiPost } from "./api";

const ok = z.object({ ok: z.boolean() });

type ReportStatus = z.infer<typeof modReportPage>["items"][number]["status"];

/** `?a=1&b=2` from the defined values, or an empty string. */
function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Users, newest first, or those whose username starts with `q`. One cursor page at a time. */
export const modUsersList = (q: string) =>
  infiniteQueryOptions({
    queryKey: ["mod", "users", q],
    queryFn: ({ pageParam }) =>
      apiGet(`/api/mod/users${queryString({ q, cursor: pageParam })}`, modUserPage),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** The report queue for one status. The open queue runs oldest first. */
export const modReportsList = (status: ReportStatus) =>
  infiniteQueryOptions({
    queryKey: ["mod", "reports", status],
    queryFn: ({ pageParam }) =>
      apiGet(`/api/mod/reports${queryString({ status, cursor: pageParam })}`, modReportPage),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Held posts then open reports, one list, with the size of the whole queue. */
export const modQueueList = infiniteQueryOptions({
  queryKey: ["mod", "queue"],
  queryFn: ({ pageParam }) =>
    apiGet(`/api/mod/queue${queryString({ cursor: pageParam })}`, modQueuePage),
  initialPageParam: "",
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

/** The audit log, newest first (admins only). */
export const auditList = infiniteQueryOptions({
  queryKey: ["mod", "audit"],
  queryFn: ({ pageParam }) =>
    apiGet(`/api/admin/audit${queryString({ cursor: pageParam })}`, auditPage),
  initialPageParam: "",
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

/**
 * Who holds a 7-digit student ID key. Looked up only on request: every lookup is logged, so it never
 * refetches by itself and is not kept in the cache.
 */
export const idHolderLookup = (key: string) =>
  queryOptions({
    queryKey: ["mod", "id-holder", key],
    queryFn: () => apiGet(`/api/mod/id-conflict${queryString({ key })}`, idConflictResult),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

/** Any mod action changes what the lists show, so all of them refresh. */
function useRefreshMod() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["mod"] });
}

export type UserAction = "ban" | "unban" | "reset-password" | "clear-probing";

/** Ban, unban, clear the probing flag of or reset the password of a user. A reset answers with the temporary password. */
export function useUserAction() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: UserAction; reason: string }) =>
      apiPost(`/api/mod/users/${id}/${action}`, z.union([temporaryPassword, ok]), { reason }),
    onSuccess: refresh,
  });
}

export function useChangeRole() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: ({ id, role, reason }: { id: number; role: "mod" | "student"; reason: string }) =>
      apiPost(`/api/admin/users/${id}/role`, ok, { role, reason }),
    onSuccess: refresh,
  });
}

export function useReleaseKey() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: (body: { userId: number; reason: string }) =>
      apiPost("/api/mod/id-conflict/release", ok, body),
    onSuccess: refresh,
  });
}

export function useResolveReport() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: "resolved" | "dismissed" }) =>
      apiPost(`/api/mod/reports/${id}/resolve`, ok, { outcome }),
    onSuccess: refresh,
  });
}

export type PostDecisionInput =
  | { decision: "approve"; reason?: string }
  | { decision: "reject"; reason: string; category: z.infer<typeof rejectCategory> };

/** A mod's approve or reject on a held post. The author is notified by the server. */
export function useDecidePost() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: ({
      targetType,
      id,
      ...input
    }: PostDecisionInput & { targetType: string; id: number }) =>
      apiPost(
        `/api/mod/posts/${encodeURIComponent(targetType)}/${id}/${input.decision}`,
        ok,
        input.decision === "approve"
          ? { reason: input.reason }
          : { reason: input.reason, category: input.category },
      ),
    onSuccess: refresh,
  });
}

export function useReverse() {
  const refresh = useRefreshMod();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiPost(`/api/admin/audit/${id}/reverse`, reverseResult, { reason }),
    onSuccess: refresh,
  });
}
