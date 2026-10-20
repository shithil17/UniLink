// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModQueuePost } from "../../../shared/schemas/moderation";
import { PostRow } from "./QueueRows";
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

function Harness({ onSubmit }: { onSubmit: (v: unknown) => void }) {
  const [rejecting, setRejecting] = useState<ModQueuePost | null>(null);
  return (
    <>
      <PostRow post={post} onReject={setRejecting} />
      <RejectPostSheet
        post={rejecting}
        pending={false}
        onSubmit={onSubmit}
        onClose={() => setRejecting(null)}
      />
    </>
  );
}

const renderRow = (onSubmit: (v: unknown) => void = () => {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness onSubmit={onSubmit} />
    </QueryClientProvider>,
  );

describe("PostRow", () => {
  it("shows the author's username, the text, the model category with confidence, and the rule flags", () => {
    renderRow();
    expect(screen.getByText("rafi_2")).toBeTruthy();
    expect(screen.getByText("Found a black umbrella")).toBeTruthy();
    expect(screen.getByText(/Scam or spam/)).toBeTruthy();
    expect(screen.getByText(/64% sure/)).toBeTruthy();
    expect(screen.getByText("Link")).toBeTruthy();
    expect(screen.getByText(/asked a moderator to look/)).toBeTruthy();
  });

  it("approves with one tap", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/posts/lost_found/3/approve");
  });

  it("asks for a reason before a reject goes anywhere", async () => {
    const onSubmit = vi.fn();
    renderRow(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reject post" }));
    await waitFor(() => expect(screen.getByText(/at least 3 characters/)).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "looks like a scam" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject post" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // The category defaults to the model's, since it is a real reason.
    expect(onSubmit.mock.calls[0][0]).toEqual({
      reason: "looks like a scam",
      category: "scam_or_spam",
    });
  });
});
