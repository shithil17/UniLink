// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
};

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

  it("asks for a reason before it sends anything", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.click(screen.getByRole("button", { name: "Ban" }));
    await waitFor(() => expect(screen.getByText(/at least 3 characters/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the temporary password once after a reset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ temporaryPassword: "ABCD2345EFGH" })),
    );
    renderSheet(student, { username: "mod_1", role: "mod" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "locked out" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("ABCD2345EFGH")).toBeTruthy();
    expect(screen.queryByLabelText("Reason")).toBeNull();
  });
});
