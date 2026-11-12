// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const toastError = vi.hoisted(() => vi.fn(() => "toast-id"));
const toastDismiss = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({ toast: { error: toastError, dismiss: toastDismiss } }));
// The login screen only needs a plain link and a navigate function, not a running router.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/signup">{children}</a>,
  useNavigate: () => vi.fn(),
}));

const { Route } = await import("./login");

const banned = (over: Record<string, unknown> = {}) => ({
  error: "account_banned",
  message: "This account is suspended.",
  reason: "Selling answers in the feed",
  contact: "admins@unilink.example",
  ...over,
});

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body, { status })),
  );
}

async function submit() {
  const Page = Route.options.component!;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Page />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "rafi_2" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  toastError.mockClear();
  toastDismiss.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("login for a suspended account", () => {
  it("shows the reason and a mailto contact in a toast that stays and in the form", async () => {
    respondWith(403, banned());
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This account is suspended.");
    expect(alert.textContent).toContain("Reason: Selling answers in the feed");
    expect(alert.querySelector("a")?.getAttribute("href")).toBe("mailto:admins@unilink.example");

    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, options] = toastError.mock.calls[0] as unknown as [
      string,
      { duration: number; description: ReactNode },
    ];
    expect(title).toBe("This account is suspended.");
    // Stays until the user dismisses it.
    expect(options.duration).toBe(Infinity);
    cleanup();
    render(<>{options.description}</>);
    expect(screen.getByText(/Selling answers in the feed/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("mailto:admins@unilink.example");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(toastDismiss).toHaveBeenCalledWith("toast-id");
  });

  it("names the admins without a link when no contact is set, and omits an empty reason", async () => {
    respondWith(403, banned({ reason: null, contact: null }));
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Contact the admins.");
    expect(alert.textContent).not.toContain("Reason:");
    expect(alert.querySelector("a")).toBeNull();
  });

  it("keeps the plain error toast for a wrong password", async () => {
    respondWith(401, { error: "invalid_credentials", message: "Wrong username or password." });
    await submit();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Wrong username or password."));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
