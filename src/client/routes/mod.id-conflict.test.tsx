// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./mod.id-conflict";

const holder = {
  id: 9,
  username: "rafi_2",
  role: "student",
  bannedAt: null,
  mustChangePassword: false,
  createdAt: 1,
  probingFlaggedAt: null,
  postingBlockedUntil: null,
  studentId: "2212345042",
};

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.startsWith("/api/auth/me")) {
    return Response.json({
      username: "mod_1",
      role: "mod",
      admissionYear: 20,
      mustChangePassword: false,
    });
  }
  if (url.startsWith("/api/mod/id-conflict/release")) return Response.json({ ok: true });
  if (url.startsWith("/api/mod/id-conflict")) return Response.json({ holder });
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

const releaseCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes("/release"));

describe("ID release confirmation", () => {
  it("names the account, never repeats the student ID, and releases only when confirmed", async () => {
    const Page = Route.options.component!;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Page />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(/digits of the student ID/), {
      target: { value: "2212345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    fireEvent.change(await screen.findByLabelText("Reason"), {
      target: { value: "not the real owner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Release ID and ban" }));

    const sheet = (
      await screen.findByRole("heading", { name: "Release ID and ban", level: 2 })
    ).closest<HTMLElement>('[role="dialog"]')!;
    expect(within(sheet).getByText(/rafi_2 · Student/)).toBeTruthy();
    expect(within(sheet).getByText("not the real owner")).toBeTruthy();
    expect(sheet.textContent).not.toContain("2212345");
    expect(releaseCalls()).toHaveLength(0);

    fireEvent.click(within(sheet).getByRole("button", { name: "Release ID and ban" }));
    await waitFor(() => expect(releaseCalls()).toHaveLength(1));
  });
});
