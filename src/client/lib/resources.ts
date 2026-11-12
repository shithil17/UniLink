import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { facultyTitle } from "../../shared/facultySearch";
import { reportCreated } from "../../shared/schemas/moderation";
import {
  helpableResourceRequestList,
  myResourceRequestPage,
  RESOURCE_EXPIRY_MAX_MS,
  RESOURCE_EXPIRY_MIN_MS,
  RESOURCE_FULFILLED_KEEP_MS,
  resourceRequest,
  resourceRequestDetail,
  resourceSubmissionOwn,
  type ResourceRequest,
  type ResourceRequestInput,
  type ResourceSubmissionInput,
} from "../../shared/schemas/resources";
import { isShareableResourceUrl, parseResourceUrl } from "../../shared/resourceUrl";
import { ApiError, apiGet, apiPost, errorMessage } from "./api";
import type { ConfirmRequest } from "./modConfirm";
import { toast } from "./toast";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

/** A span as a person says it: "1 hour", "3 days", "3 months". Whole units only, rounded down to the largest that fits. */
export function durationWords(ms: number): string {
  const [n, unit] =
    ms >= MONTH && ms % MONTH === 0
      ? [ms / MONTH, "month"]
      : ms >= DAY
        ? [Math.round(ms / DAY), "day"]
        : [Math.max(1, Math.round(ms / HOUR)), "hour"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

// How long a request can stay open is the requester's pick from these. The longest is kept short of
// the server's maximum so a phone clock a little ahead of the server's never makes the pick invalid.
// ceiling: five fixed choices; a free date picker is more to get wrong on a phone. Revisit if
// students ask for dates in between.
const EXPIRY_CHOICE_DAYS = [1, 3, 7, 14, 30];

export type ExpiryChoice = { ms: number; label: string };

/** The expiry choices, each inside the server's allowed range (from the shared limits). */
export const EXPIRY_CHOICES: readonly ExpiryChoice[] = EXPIRY_CHOICE_DAYS.map((d) => d * DAY)
  .filter((ms) => ms >= RESOURCE_EXPIRY_MIN_MS && ms < RESOURCE_EXPIRY_MAX_MS)
  .map((ms) => ({ ms, label: durationWords(ms) }));

/** The instant a request lapses when it is kept open for `ms` from `now`. */
export const expiresAtFor = (ms: number, now: number = Date.now()) => now + ms;

/** What a new request starts with: a week, the choice in the middle. */
export const DEFAULT_EXPIRY_MS = 7 * DAY;

/** The two sentences that say when a request is deleted. Built from the same limits the server runs on. */
export function purgeNotice(): { open: string; fulfilled: string } {
  return {
    open: "A request that expires without an accepted link is deleted.",
    fulfilled: `Once you accept a link, the request and its links are deleted ${durationWords(RESOURCE_FULFILLED_KEEP_MS)} later. Save what you need before then.`,
  };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Dhaka",
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Dhaka",
});

/** "20 Nov, 6:00 pm" in Asia/Dhaka. */
export const when = (at: number) =>
  dateFormat.format(at).replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());

/** How long is left: "3 days left", "5 hours left", "Under an hour left". Empty once it has passed. */
export function timeLeft(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return "";
  if (left < HOUR) return "Under an hour left";
  const [n, unit] =
    left >= DAY ? [Math.floor(left / DAY), "day"] : [Math.floor(left / HOUR), "hour"];
  return `${n} ${unit}${n === 1 ? "" : "s"} left`;
}

/** "You sent a link" / "You sent 2 links". Empty when none. */
export const sentLinksLine = (n: number) =>
  n === 0 ? "" : `You sent ${n === 1 ? "a link" : `${n} links`}`;

/**
 * The line under a request that says when it goes away. An open request names its expiry; a
 * fulfilled one names the day it is deleted (the keep period after the accept); an expired one says
 * it is cleared automatically.
 */
export function expiryLine(
  r: Pick<ResourceRequest, "state" | "expiresAt" | "fulfilledAt">,
  now: number,
): string {
  if (r.state === "fulfilled" && r.fulfilledAt !== null) {
    return `Fulfilled ${dayFormat.format(r.fulfilledAt)}. Deleted on ${dayFormat.format(r.fulfilledAt + RESOURCE_FULFILLED_KEEP_MS)}.`;
  }
  if (r.state === "expired") {
    return `Expired ${dayFormat.format(r.expiresAt)}. It is deleted automatically.`;
  }
  const left = timeLeft(r.expiresAt, now);
  return `${left ? `${left}. ` : ""}Expires ${when(r.expiresAt)}, then it is deleted.`;
}

/** The words a request goes by: its course code, its faculty member, or both. */
export function requestHeading(r: Pick<ResourceRequest, "courseCode" | "faculty">): {
  course: string | null;
  faculty: string | null;
} {
  return { course: r.courseCode, faculty: r.faculty ? facultyTitle(r.faculty) : null };
}

/** The link as the page can safely open it, or null for anything that is not a safe https link. */
export function safeLink(url: string): string | null {
  return isShareableResourceUrl(url) ? url : null;
}

/** The host of a shareable link, for a row that should not print a whole share URL. */
export function linkHost(url: string): string {
  return parseResourceUrl(url)?.hostname.replace(/^www\./, "") ?? "";
}

/**
 * What a toast says when a post is refused. A new account's 429 gets its own title, with the
 * server's sentence (how long to wait) underneath; everything else is the server's message.
 */
export function postFailure(err: unknown): { title: string; description?: string } {
  if (err instanceof ApiError && err.status === 429 && err.code === "new_account") {
    return { title: "New accounts can't post yet", description: errorMessage(err) };
  }
  return { title: errorMessage(err) };
}

export function toastPostFailure(err: unknown) {
  const { title, description } = postFailure(err);
  toast.error(title, description ? { description } : undefined);
}

// ---- Queries -------------------------------------------------------------------------------------

/** The signed-in student's own requests with the links sent to them, newest first. Every resource write invalidates the `resources` prefix. */
export const myRequestsQuery = infiniteQueryOptions({
  queryKey: ["resources", "mine"],
  queryFn: ({ pageParam }) =>
    apiGet(
      pageParam
        ? `/api/resources/requests/mine?cursor=${encodeURIComponent(pageParam)}`
        : "/api/resources/requests/mine",
      myResourceRequestPage,
    ),
  initialPageParam: "",
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});

/**
 * Open requests the student can help with: any for a course they recorded, plus faculty-only ones for a
 * faculty member they had. Same-faculty ones come first. Under the `resources` prefix, so every write refreshes it.
 */
export const helpableRequestsQuery = queryOptions({
  queryKey: ["resources", "helpable"],
  queryFn: () => apiGet("/api/resources/requests/helpable", helpableResourceRequestList),
});

/** One request for someone who may help: the request and their own links to it. A 404 means it is closed or gone. */
export const requestDetailQuery = (id: number) =>
  queryOptions({
    queryKey: ["resources", "request", id],
    queryFn: () => apiGet(`/api/resources/requests/${id}`, resourceRequestDetail),
    // A closed request will not reopen, so do not ask again on every focus.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

// ---- Mutations -----------------------------------------------------------------------------------

const ok = z.object({ ok: z.boolean() });

function useRefreshResources() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["resources"] });
}

export function useCreateRequest() {
  const refresh = useRefreshResources();
  return useMutation({
    mutationFn: (input: ResourceRequestInput) =>
      apiPost("/api/resources/requests", resourceRequest, input),
    onSuccess: refresh,
  });
}

export function useSubmitLink(requestId: number) {
  const refresh = useRefreshResources();
  return useMutation({
    mutationFn: (input: ResourceSubmissionInput) =>
      apiPost(`/api/resources/requests/${requestId}/submissions`, resourceSubmissionOwn, input),
    onSuccess: refresh,
    // A 409 means the request closed or this student is out of links: the screen should say so.
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) void refresh();
    },
  });
}

export function useDecideLink(decision: "accept" | "reject") {
  const refresh = useRefreshResources();
  return useMutation({
    mutationFn: (submissionId: number) =>
      apiPost(`/api/resources/submissions/${submissionId}/${decision}`, ok),
    onSuccess: refresh,
    onError: () => void refresh(),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: {
      targetType: "resource_request" | "resource_submission";
      targetId: number;
      reason: string;
    }) => apiPost("/api/reports", reportCreated, input),
  });
}

// ---- Confirm -------------------------------------------------------------------------------------

/** What the confirm sheet says before an accept goes out. Accepting closes the request, so it is asked once. */
export function acceptLinkConfirm(uploader: string, run: () => Promise<unknown>): ConfirmRequest {
  return {
    title: "Accept this link",
    confirmLabel: "Accept link",
    lead: "Accepting closes your request. You can't change your mind afterwards.",
    facts: [{ label: "Sent by", value: uploader }],
    effects: [
      "No more links can be sent to this request.",
      `${uploader} is told their link was accepted.`,
      `The request and its links are deleted ${durationWords(RESOURCE_FULFILLED_KEEP_MS)} from now.`,
    ],
    run,
  };
}
