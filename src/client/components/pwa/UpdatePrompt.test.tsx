// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { UpdatePrompt } from "./UpdatePrompt";

// A waiting worker that becomes active once it is told to skip waiting.
const waiting = Object.assign(new EventTarget(), { state: "installed" });
const updateServiceWorker = vi.fn(() => {
  waiting.state = "activated";
  waiting.dispatchEvent(new Event("statechange"));
  return Promise.resolve();
});

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: {
    onRegisteredSW: (url: string, registration: ServiceWorkerRegistration) => void;
  }) => {
    useEffect(() => {
      options.onRegisteredSW("/sw.js", {
        waiting,
        update: () => Promise.resolve(),
      } as unknown as ServiceWorkerRegistration);
    }, [options]);
    return {
      needRefresh: [true, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker,
    };
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reloads an uncontrolled page once the new worker is active", () => {
  const reload = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { controller: null } });
  vi.stubGlobal("location", { reload });

  render(<UpdatePrompt />);
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));

  expect(updateServiceWorker).toHaveBeenCalled();
  expect(reload).toHaveBeenCalledOnce();
});
