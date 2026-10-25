// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../../shared/schemas/auth";
import { AppLayout } from "./AppLayout";

// The PWA prompts talk to the service worker, which does not exist here.
vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.removeItem("unilink-rail");
});

async function renderShell(me: Me | null, path = "/", unread?: number) {
  // Nothing in the shell should hit the network; a failed poll only hides the badge. A test that
  // wants a badge answers the one unread-count request.
  vi.stubGlobal("fetch", () =>
    unread === undefined
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(
          new Response(JSON.stringify({ count: unread }), {
            headers: { "content-type": "application/json" },
          }),
        ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["me"], me);
  const root = createRootRoute({ component: () => <AppLayout>content</AppLayout> });
  const routes = ["/", "/courses", "/routine", "/inbox", "/mod/queue", "/settings"].map((p) =>
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
  it("shows no tab bar when signed out, only the wordmark", async () => {
    await renderShell(null);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.getByRole("link", { name: "UniLink" })).toBeTruthy();
  });

  it("shows no tabs while a temporary password is being replaced", async () => {
    await renderShell({ ...user("student"), mustChangePassword: true });
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.queryByText("Courses")).toBeNull();
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

describe("AppLayout tab pill", () => {
  const pill = () => screen.getByTestId("tab-pill");
  const index = () =>
    screen.getByRole("navigation", { name: "Main" }).style.getPropertyValue("--i");

  it("sits at the active tab's position for a student", async () => {
    await renderShell(user("student"), "/routine");
    // Home, Courses, Routine, Inbox, Settings
    expect(index()).toBe("2");
    expect(pill().hasAttribute("data-hidden")).toBe(false);
  });

  it("sits at the active tab's position for a mod, whose bar swaps Routine for Mod", async () => {
    await renderShell(user("mod"), "/mod/queue");
    // Home, Courses, Inbox, Mod, Settings
    expect(index()).toBe("3");
  });

  it("hides when no tab is active, for example a mod's own routine", async () => {
    await renderShell(user("mod"), "/routine");
    expect(pill().hasAttribute("data-hidden")).toBe(true);
  });
});

describe("AppLayout unread badge", () => {
  it("shows the capped count and a spoken count on the Inbox tab only", async () => {
    await renderShell(user("student"), "/", 12);
    const inbox = await screen.findByRole("link", { name: /Inbox/ });
    await waitFor(() => expect(inbox.textContent).toContain("9+"));
    expect(inbox.querySelector(".sr-only")?.textContent).toBe(", 12 unread");
    expect(screen.getByRole("link", { name: /Courses/ }).textContent).not.toContain("9+");
  });

  it("shows no badge at zero", async () => {
    await renderShell(user("student"), "/", 0);
    const inbox = screen.getByRole("link", { name: /Inbox/ });
    await new Promise((r) => setTimeout(r, 20));
    expect(inbox.querySelector(".sr-only")).toBeNull();
  });
});

describe("AppLayout rail", () => {
  it("shows the signed-in username in the rail", async () => {
    await renderShell({ ...user("student"), username: "tasnim" });
    expect(screen.getByText("tasnim")).toBeTruthy();
  });

  it("collapses, saves the choice, and restores it after a remount", async () => {
    await renderShell(user("student"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    await waitFor(() => expect(localStorage.getItem("unilink-rail")).toBe("collapsed"));
    expect(
      screen.getByRole("complementary", { name: "Sidebar" }).getAttribute("data-collapsed"),
    ).toBe("true");

    cleanup();
    await renderShell(user("student"));
    expect(screen.getByRole("button", { name: "Keep sidebar open" })).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Sidebar" }).getAttribute("data-collapsed"),
    ).toBe("true");
  });

  it("pins the rail open when Keep sidebar open is clicked", async () => {
    await renderShell(user("student"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const keepOpen = await screen.findByRole("button", { name: "Keep sidebar open" });
    fireEvent.click(keepOpen);

    await waitFor(() => expect(localStorage.getItem("unilink-rail")).toBe("expanded"));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Sidebar" }).getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("keeps tab link names available and hides the toggle below md", async () => {
    await renderShell(user("student"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    for (const label of ["Home", "Courses", "Routine", "Inbox", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Keep sidebar open" }).className).toContain("hidden");
    expect(screen.getByRole("button", { name: "Keep sidebar open" }).className).toContain(
      "md:flex",
    );
  });
});
