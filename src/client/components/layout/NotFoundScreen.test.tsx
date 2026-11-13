// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../../shared/schemas/auth";
import { NotFoundScreen } from "./NotFoundScreen";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const student: Me = {
  username: "u",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

async function renderAt(entries: string[], me: Me | null = null) {
  // The cached user may refetch on mount; nothing here should reach the network.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["me"], me);
  const root = createRootRoute({ component: Outlet, notFoundComponent: NotFoundScreen });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => "home" });
  const router = createRouter({
    routeTree: root.addChildren([home]),
    history: createMemoryHistory({ initialEntries: entries, initialIndex: entries.length - 1 }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { level: 1 });
}

describe("NotFoundScreen", () => {
  it("shows for an unknown URL with a way home and the requested path", async () => {
    await renderAt(["/does-not-exist"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page skipped class");
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("/does-not-exist").tagName).toBe("CODE");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("404");
  });

  it("offers quick links only when signed in", async () => {
    await renderAt(["/nope"]);
    expect(screen.queryByRole("navigation", { name: "Quick links" })).toBeNull();
    cleanup();
    await renderAt(["/nope"], student);
    const links = screen.getByRole("navigation", { name: "Quick links" });
    expect(links.textContent).toBe("CoursesRoutineMaterials");
  });

  it("Go back returns to the previous screen", async () => {
    await renderAt(["/", "/nope"]);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("home")).toBeTruthy();
  });

  it("Go back falls back to Home when nothing is behind it", async () => {
    await renderAt(["/nope"]);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("home")).toBeTruthy();
  });
});
