// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModQueuePost, ModReport } from "../../../shared/schemas/moderation";
import { PostRow, ReportRow } from "./QueueRows";
import { RejectPostSheet } from "./RejectPostSheet";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const post: ModQueuePost = {
  kind: "post",
  targetType: "lost_found",
  id: 3,
  text: ["Found a black umbrella"],
  author: "rafi_2",
  category: "scam_or_spam",
  confidence: 0.64,
  flags: ["url"],
  model: "clef-flash",
  appealed: true,
};

function Harness({ onReject }: { onReject: (v: unknown) => Promise<unknown> }) {
  const [rejecting, setRejecting] = useState<ModQueuePost | null>(null);
  return (
    <>
      <PostRow post={post} onReject={setRejecting} />
      <RejectPostSheet post={rejecting} onReject={onReject} onClose={() => setRejecting(null)} />
    </>
  );
}

/** The sheet whose heading is `title`, once it is open. */
const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

const renderRow = (onReject: (v: unknown) => Promise<unknown> = async () => {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness onReject={onReject} />
    </QueryClientProvider>,
  );

describe("PostRow", () => {
  it("shows the author's username, the text, and the model category with confidence", () => {
    renderRow();
    expect(screen.getByText("rafi_2")).toBeTruthy();
    expect(screen.getByText("Found a black umbrella")).toBeTruthy();
    expect(screen.getByText(/Scam or spam/)).toBeTruthy();
    expect(screen.getByText(/64% sure/)).toBeTruthy();
  });

  it("sends nothing on Approve until the confirm sheet is confirmed", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const sheet = await sheetTitled("Approve post");
    // It names who it is about and says the author hears about it.
    expect(within(sheet).getByText("rafi_2")).toBeTruthy();
    expect(within(sheet).getByText(/inbox message/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Approve post" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/posts/lost_found/3/approve");
  });

  it("sends nothing when Approve is cancelled", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const sheet = await sheetTitled("Approve post");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Approve post" })).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for a reason, then a confirmation, before a reject goes anywhere", async () => {
    const onReject = vi.fn(async (_values: unknown) => {});
    renderRow(onReject);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reject post" }));
    await waitFor(() => expect(screen.getByText(/at least 3 characters/)).toBeTruthy());
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "looks like a scam" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject post" }));
    // The form passed; the confirm sheet now sums it up and nothing has been sent.
    const confirm = await sheetTitled("Reject post");
    expect(within(confirm).getByText("looks like a scam")).toBeTruthy();
    expect(within(confirm).getByText("Scam or spam")).toBeTruthy();
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Reject post" }));
    await waitFor(() => expect(onReject).toHaveBeenCalled());
    // The category defaults to the model's, since it is a real reason.
    expect(onReject.mock.calls[0][0]).toEqual({
      reason: "looks like a scam",
      category: "scam_or_spam",
    });
  });
});

const report: ModReport = {
  id: 8,
  targetType: "user",
  targetId: "5",
  targetLabel: "sam_1",
  reporter: "rafi_2",
  reason: "keeps spamming the board",
  status: "open",
  createdAt: 1,
  resolvedAt: null,
  resolveNote: null,
};

describe("ReportRow", () => {
  // The row links to the user's screen, so it needs a router around it.
  const renderReport = async (row: ModReport = report) => {
    const router = createRouter({
      routeTree: createRootRoute({ component: () => <ReportRow report={row} now={1000} /> }),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByText(row.reason);
  };

  const linkReport: ModReport = {
    ...report,
    id: 9,
    targetType: "resource_submission",
    targetId: "4",
    targetLabel: "https://example-site.com/notes",
    reason: "not what I asked for",
  };

  it("resolves a report only after the summary is confirmed", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await renderReport();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const sheet = await sheetTitled("Dismiss report");
    expect(within(sheet).getByText("sam_1")).toBeTruthy();
    expect(within(sheet).getByText("keeps spamming the board")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Dismiss report" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/reports/8/resolve");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      outcome: "dismissed",
    });
  });

  it("sends nothing when Mark handled is cancelled", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await renderReport();
    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));
    const sheet = await sheetTitled("Mark report handled");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Mark report handled" })).toBeNull(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers Remove only on a request or a link, and only while the report is open", async () => {
    await renderReport();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    cleanup();
    await renderReport({ ...linkReport, status: "resolved" });
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    cleanup();
    await renderReport(linkReport);
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("removes a link only after a reason and a confirmation", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await renderReport(linkReport);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const form = await sheetTitled("Remove this link");

    // An empty reason is refused in the form and nothing is sent.
    fireEvent.click(within(form).getByRole("button", { name: "Remove link" }));
    await waitFor(() => expect(screen.getByText(/at least 3 characters/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText("Reason"), {
      target: { value: "not course material" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Remove link" }));
    const confirm = await sheetTitled("Remove link");
    expect(within(confirm).getByText("https://example-site.com/notes")).toBeTruthy();
    expect(within(confirm).getByText("not course material")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Remove link" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/reports/9/remove");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      reason: "not course material",
    });
  });
});
