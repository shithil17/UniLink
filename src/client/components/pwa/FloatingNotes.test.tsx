// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { INSTALL_HINT_STORAGE_KEY } from "@/lib/installHint";
import { FloatingNotes } from "./FloatingNotes";
import { InstallHint } from "./InstallHint";
import { UpdatePrompt } from "./UpdatePrompt";

// A waiting service worker, and an iPhone Safari tab that has not installed the app.
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [true, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));
vi.mock("@/lib/installHint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/installHint")>()),
  readInstallHintEnv: () => ({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1",
    standalone: false,
    dismissed: false,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderShelf() {
  return render(
    <FloatingNotes>
      <UpdatePrompt />
      <InstallHint />
    </FloatingNotes>,
  );
}

describe("floating PWA notes", () => {
  it("announces the update and keeps the Reload action", () => {
    renderShelf();
    expect(screen.getByRole("status").textContent).toContain("A new version is ready");
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("dismisses the update prompt with Escape while it has focus", () => {
    renderShelf();
    const dismiss = screen.getAllByRole("button", { name: "Dismiss" })[0]!;
    dismiss.focus();
    fireEvent.keyDown(dismiss, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("dismisses the install hint with Escape and remembers it", () => {
    renderShelf();
    fireEvent.keyDown(screen.getByRole("note"), { key: "Escape" });
    expect(screen.queryByRole("note")).toBeNull();
    expect(localStorage.getItem(INSTALL_HINT_STORAGE_KEY)).toBe("1");
  });

  it("dismisses through the Dismiss buttons", () => {
    renderShelf();
    const buttons = screen.getAllByRole("button", { name: "Dismiss" });
    expect(buttons).toHaveLength(2);
    for (const b of buttons) fireEvent.click(b);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });
});
