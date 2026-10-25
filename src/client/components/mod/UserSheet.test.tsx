// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModUser } from "../../../shared/schemas/moderation";
import { UserSheet } from "./UserSheet";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const student: ModUser = {
  id: 5,
  username: "rafi_2",
  role: "student",
  bannedAt: null,
  mustChangePassword: false,
  createdAt: 1,
  probingFlaggedAt: null,
  postingBlockedUntil: null,
};

/** The confirm sheet whose heading is `title`, once it is open. */
const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

function renderSheet(user: ModUser, me: { username: string; role: "mod" | "admin" }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UserSheet user={user} me={me} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe("UserSheet", () => {
  it("offers ban and reset to a mod but no role change", () => {
    renderSheet(student, { username: "mod_1", role: "mod" });
    expect(screen.getByRole("button", { name: "Ban" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make mod" })).toBeNull();
  });

  it("offers the role change to an admin, and unban for a banned user", () => {
    renderSheet({ ...student, bannedAt: 10 }, { username: "boss", role: "admin" });
    expect(screen.getByRole("button", { name: "Make mod" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unban" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ban" })).toBeNull();
  });

  it("offers nothing on another mod to a mod, on an admin, or on yourself", () => {
    for (const [user, me] of [
      [
        { ...student, role: "mod" as const },
        { username: "mod_1", role: "mod" as const },
      ],
      [
        { ...student, role: "admin" as const },
        { username: "boss", role: "admin" as const },
      ],
      [student, { username: "rafi_2", role: "mod" as const }],
    ] as const) {
      renderSheet(user, me);
      expect(screen.queryByRole("button", { name: "Ban" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
      cleanup();
    }
  });

  it("shows the probing flag and lets a mod clear it, with a reason, after confirming", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const flagged = { ...student, probingFlaggedAt: 5, postingBlockedUntil: Date.now() + 600_000 };
    renderSheet(flagged, { username: "mod_1", role: "mod" });
    expect(screen.getByText(/Posting is paused for another/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "honest mistakes" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear flag" }));
    const sheet = await sheetTitled("Clear flag");
    expect(within(sheet).getByText("honest mistakes")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Clear flag" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/users/5/clear-probing");
  });

  it("offers no clear-flag button for an unflagged user", () => {
    renderSheet(student, { username: "mod_1", role: "mod" });
    expect(screen.queryByRole("button", { name: "Clear flag" })).toBeNull();
  });

  it("asks for a reason before it sends anything", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.click(screen.getByRole("button", { name: "Ban" }));
    await waitFor(() => expect(screen.getByText(/at least 3 characters/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the temporary password once after a reset is confirmed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ temporaryPassword: "ABCD2345EFGH" })),
    );
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "locked out" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    const sheet = await sheetTitled("Reset password");
    fireEvent.click(within(sheet).getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("ABCD2345EFGH")).toBeTruthy();
    expect(screen.queryByLabelText("Reason")).toBeNull();
  });

  it("sends nothing on Ban until it is confirmed, and nothing when it is cancelled", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "posted a scam" } });
    fireEvent.click(screen.getByRole("button", { name: "Ban" }));

    // The summary names the user and the reason, and says what follows. No student ID anywhere.
    let sheet = await sheetTitled("Ban user");
    expect(within(sheet).getByText(/rafi_2 · Student/)).toBeTruthy();
    expect(within(sheet).getByText("posted a scam")).toBeTruthy();
    expect(within(sheet).getByText(/signed out everywhere/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ban user" })).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();

    // Back on the form, Ban opens the sheet again, and its button is what sends.
    fireEvent.click(screen.getByRole("button", { name: "Ban" }));
    sheet = await sheetTitled("Ban user");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Ban user" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/users/5/ban");
  });

  it("keeps the confirm sheet open with the error inline when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "already_banned", message: "That user is already banned." },
          { status: 409 },
        ),
      ),
    );
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "posted a scam" } });
    fireEvent.click(screen.getByRole("button", { name: "Ban" }));
    const sheet = await sheetTitled("Ban user");
    fireEvent.click(within(sheet).getByRole("button", { name: "Ban user" }));
    expect((await within(sheet).findByRole("alert")).textContent).toContain("already banned");
    // Still open, and the button works again for a retry.
    expect(within(sheet).getByRole("button", { name: "Ban user" })).toBeTruthy();
  });

  it("shows the role change as a before and after, and sends it only once confirmed", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderSheet(student, { username: "boss", role: "admin" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "helps a lot" } });
    fireEvent.click(screen.getByRole("button", { name: "Make mod" }));
    const sheet = await sheetTitled("Make mod");
    expect(within(sheet).getByText("Student")).toBeTruthy();
    expect(within(sheet).getByText("Mod")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Make mod" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/users/5/role");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      role: "mod",
      reason: "helps a lot",
    });
  });
});
