// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Notification } from "../../../shared/schemas/inbox";
import { InboxRow } from "./InboxRow";

afterEach(cleanup);

const NOW = Date.UTC(2026, 9, 20, 12);
const make = (over: Partial<Notification> = {}): Notification => ({
  id: 1,
  type: "post_rejected",
  payload: {},
  readAt: null,
  createdAt: NOW - 5 * 60_000,
  ...over,
});

describe("InboxRow", () => {
  it("says an unread row is unread in words, and marks it read when opened", () => {
    const onOpen = vi.fn();
    render(<InboxRow n={make()} now={NOW} onOpen={onOpen} />);
    expect(screen.getByText("(unread)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("keeps a read row from being a control", () => {
    render(<InboxRow n={make({ readAt: NOW })} now={NOW} onOpen={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("(unread)")).toBeNull();
    expect(screen.getByText("5 min ago")).toBeTruthy();
  });
});
