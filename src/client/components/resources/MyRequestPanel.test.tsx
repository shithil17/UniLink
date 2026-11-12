// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MyResourceRequest } from "../../../shared/schemas/resources";
import { MyRequestPanel } from "./MyRequestPanel";

afterEach(cleanup);

const NOW = Date.UTC(2026, 10, 12, 6);
const request = (over: Partial<MyResourceRequest> = {}): MyResourceRequest => ({
  id: 1,
  courseCode: "CSE115",
  facultyId: null,
  faculty: null,
  note: "Midterm notes",
  status: "published",
  state: "open",
  expiresAt: NOW + 3 * 86_400_000,
  fulfilledAt: null,
  createdAt: NOW - 3_600_000,
  submissions: [
    {
      id: 5,
      url: "https://drive.google.com/file/d/1",
      note: "Spring 2026",
      uploader: "sam",
      decision: "open",
      sameFaculty: null,
      createdAt: NOW - 60_000,
    },
  ],
  ...over,
});

const noop = () => {};
const render_ = (r: MyResourceRequest, handlers = { onAccept: noop, onReject: noop }) =>
  render(<MyRequestPanel request={r} now={NOW} busy={false} onReport={noop} {...handlers} />);

describe("MyRequestPanel", () => {
  it("says in words whether the sender took the same faculty, and says nothing when the request names none", () => {
    const link = (id: number, uploader: string, sameFaculty: boolean | null) => ({
      id,
      url: "https://drive.google.com/file/d/1",
      note: null,
      uploader,
      decision: "open" as const,
      sameFaculty,
      createdAt: NOW - 60_000,
    });
    render_(
      request({
        submissions: [link(1, "sam", true), link(2, "rae", false), link(3, "kim", null)],
      }),
    );
    expect(screen.getAllByText("Took it with the same faculty")).toHaveLength(1);
    expect(screen.getAllByText("Different faculty, or not recorded")).toHaveLength(1);
    expect(screen.getByText("kim")).toBeTruthy();
    expect(screen.queryAllByText(/faculty/)).toHaveLength(2);
  });

  it("shows the link, its sender's username and the expiry wording", () => {
    render_(request());
    const link = screen.getByRole("link", { name: /Open on drive.google.com/ });
    expect(link.getAttribute("href")).toBe("https://drive.google.com/file/d/1");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("sam")).toBeTruthy();
    expect(screen.getByText(/then it is deleted/)).toBeTruthy();
  });

  it("offers Accept and Turn down on an open link of an open request", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render_(request(), { onAccept, onReject });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn down" }));
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it("takes the choices away once the request is fulfilled and names the deletion day", () => {
    const r = request({
      state: "fulfilled",
      fulfilledAt: Date.UTC(2026, 10, 10),
      submissions: [{ ...request().submissions[0], decision: "accepted" }],
    });
    render_(r);
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Turn down" })).toBeNull();
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(screen.getByText(/Deleted on 8 Feb/)).toBeTruthy();
  });

  it("does not make a non-allowlisted URL into a link", () => {
    const r = request({
      submissions: [{ ...request().submissions[0], url: "javascript:alert(1)" }],
    });
    render_(r);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says a held request is waiting for a moderator", () => {
    render_(request({ status: "pending_review", submissions: [] }));
    expect(screen.getByText(/Waiting for a moderator/)).toBeTruthy();
  });
});
