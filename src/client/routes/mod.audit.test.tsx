// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AuditEntry } from "../../shared/schemas/moderation";
import { Route } from "./mod.audit";

const entry: AuditEntry = {
  id: 12,
  actor: "mod_1",
  action: "ban",
  targetType: "user",
  targetId: "5",
  targetLabel: "rafi_2",
  reason: "posted a scam",
  createdAt: 1,
  reverses: null,
  reversedBy: null,
  reversible: true,
};

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.startsWith("/api/auth/me")) {
    return Response.json({
      username: "boss",
      role: "admin",
      admissionYear: 20,
      mustChangePassword: false,
    });
  }
  if (url.startsWith("/api/admin/audit/12/reverse"))
    return Response.json({ id: 13 }, { status: 201 });
  if (url.startsWith("/api/admin/audit"))
    return Response.json({ items: [entry], nextCursor: null });
  return Response.json({}, { status: 404 });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reverseCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes("/reverse"));

const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

describe("audit reversal confirmation", () => {
  it("summarises the entry and reverses only when confirmed", async () => {
    const Page = Route.options.component!;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Page />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reverse" }));
    const form = await sheetTitled("Reverse this action");
    fireEvent.change(within(form).getByLabelText("Reason"), { target: { value: "was a mistake" } });
    fireEvent.click(within(form).getByRole("button", { name: "Reverse" }));

    const sheet = await sheetTitled("Reverse action");
    expect(within(sheet).getByText("was a mistake")).toBeTruthy();
    expect(within(sheet).getByText("mod_1")).toBeTruthy();
    expect(within(sheet).getByText(/unbanned/)).toBeTruthy();
    expect(reverseCalls()).toHaveLength(0);

    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Reverse action" })).toBeNull(),
    );
    expect(reverseCalls()).toHaveLength(0);

    fireEvent.click(within(form).getByRole("button", { name: "Reverse" }));
    const again = await sheetTitled("Reverse action");
    fireEvent.click(within(again).getByRole("button", { name: "Reverse action" }));
    await waitFor(() => expect(reverseCalls()).toHaveLength(1));
  });
});
