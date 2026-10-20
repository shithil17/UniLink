// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../../shared/schemas/auth";
import { AppLayout } from "./AppLayout";

// The PWA prompts talk to the service worker, which does not exist here.
vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderShell(me: Me | null, path = "/") {
  // Nothing in the shell should hit the network; a failed poll only hides the badge.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["me"], me);
  const root = createRootRoute({ component: () => <AppLayout>content</AppLayout> });
  const routes = ["/", "/courses", "/routine", "/mod/queue", "/settings"].map((p) =>
    createRoute({ getParentRoute: () => root, path: p }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("content");
}

const user = (role: Me["role"]): Me => ({
  username: "u",
  role,
  admissionYear: 22,
  mustChangePassword: false,
});

describe("AppLayout navigation", () => {
  it("shows no tab bar when signed out", async () => {
    await renderShell(null);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("gives a student five tabs and marks the current one", async () => {
    await renderShell(user("student"), "/courses");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(nav.querySelector("[aria-current=page]")?.textContent).toContain("Courses");
  });

  it("gives a mod a Mod tab that stays current inside the panel", async () => {
    await renderShell(user("mod"), "/mod/queue");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(nav.querySelector("[aria-current=page]")?.textContent).toContain("Mod");
  });
});
