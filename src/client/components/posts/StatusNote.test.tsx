// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { rejectReasonMessage } from "../../../shared/rejectReasons";
import { StatusNote } from "./StatusNote";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderNote = (props: Parameters<typeof StatusNote>[0]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StatusNote {...props} />
    </QueryClientProvider>,
  );

describe("StatusNote", () => {
  it("says nothing for a published post", () => {
    const { container } = renderNote({ status: "published", what: "ride" });
    expect(container.textContent).toBe("");
  });

  it("says a held post is waiting for a moderator, with no appeal", () => {
    renderNote({
      status: "pending_review",
      what: "ride",
      appeal: { targetType: "resource_request", id: 1 },
    });
    expect(screen.getByText(/Waiting for a moderator/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives the rejection reason and asks a moderator to look through the appeal endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderNote({
      status: "rejected",
      what: "request",
      category: "off_topic",
      appeal: { targetType: "resource_request", id: 7 },
    });
    expect(screen.getByText(new RegExp(rejectReasonMessage("off_topic")))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ask a moderator to look" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/posts/resource_request/7/appeal");
    expect(init.method).toBe("POST");
  });

  it("offers no appeal button where the post can't be appealed", () => {
    renderNote({ status: "rejected", what: "link", category: "fine" });
    expect(screen.getByText(/didn't approve this link/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
