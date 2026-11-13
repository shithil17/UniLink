// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const readPushState = vi.hoisted(() => vi.fn());
vi.mock("@/lib/push", () => ({
  readPushState,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  fetchPublicKey: vi.fn(),
}));

const { PushSwitch } = await import("./PushSwitch");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  readPushState.mockReset();
});

function renderSwitch() {
  // The admin-only test row asks who is signed in; nobody is, so it renders nothing.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 })),
  );
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PushSwitch />
    </QueryClientProvider>,
  );
}

describe("PushSwitch", () => {
  it("holds the row's space with a skeleton while the device state loads", () => {
    readPushState.mockReturnValue(new Promise(() => {}));
    const { container } = renderSwitch();
    const row = container.querySelector("[data-slot=push-switch-skeleton]");
    expect(row?.className).toContain("min-h-15");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("says the same thing whether the switch is on or off, so toggling never rewraps it", async () => {
    readPushState.mockResolvedValue("off");
    const off = renderSwitch();
    const offHint = (await screen.findByText(/alert on this device/)).textContent;
    off.unmount();

    readPushState.mockResolvedValue("on");
    renderSwitch();
    expect((await screen.findByText(/alert on this device/)).textContent).toBe(offHint);
  });
});
