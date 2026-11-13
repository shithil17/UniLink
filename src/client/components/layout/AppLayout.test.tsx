// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  const routes = [
    "/",
    "/courses",
    "/resources",
    "/routine",
    "/inbox",
    "/mod/queue",
    "/settings",
    "/change-password",
  ].map((p) => createRoute({ getParentRoute: () => root, path: p }));
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

  it("keeps the wordmark in a header when signed in, for phones where the rail is hidden", async () => {
    await renderShell(user("student"));
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "UniLink" })).toBeTruthy();
  });

  it("shows no tabs while a temporary password is being replaced", async () => {
    await renderShell({ ...user("student"), mustChangePassword: true });
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.queryByText("Courses")).toBeNull();
  });

  it("links every student tab, including Materials, and marks the current one", async () => {
    await renderShell(user("student"), "/courses");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a")).toHaveLength(7);
    expect(within(nav).getByRole("link", { name: "Materials" })).toBeTruthy();
    expect(nav.querySelector("[aria-current=page]")?.textContent).toContain("Courses");
  });

  it("gives a mod a Mod tab that stays current inside the panel", async () => {
    await renderShell(user("mod"), "/mod/queue");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a")).toHaveLength(8);
    expect(nav.querySelector("[aria-current=page]")?.textContent).toContain("Mod");
  });

  it("hides the More tabs from the phone bar, where the More button stands in for them", async () => {
    await renderShell(user("student"));
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const label of ["Rides", "Routine", "Settings"]) {
      expect(within(nav).getByRole("link", { name: label }).classList).toContain("max-md:hidden");
    }
    expect(within(nav).getByRole("link", { name: "Materials" }).classList).not.toContain(
      "max-md:hidden",
    );
    expect(within(nav).getByRole("button", { name: "More" }).classList).toContain("md:hidden");
  });

  it("opens a sheet listing the More tabs with their hints", async () => {
    await renderShell(user("mod"));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("navigation", { name: "More" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "RidesShare a ride or find one",
      "RoutineYour classes for the week",
      "ModHeld posts, users and curriculum",
      "SettingsTheme, password and account",
    ]);
  });

  it("marks More as where you are while a More screen is open", async () => {
    await renderShell(user("student"), "/settings");
    const more = screen.getByRole("button", { name: /More/ });
    expect(more.hasAttribute("data-current")).toBe(true);
    expect(more.textContent).toContain("Settings open");
  });
});

describe("AppLayout tab pill", () => {
  const pill = () => screen.getByTestId("tab-pill");
  const index = () =>
    screen.getByRole("navigation", { name: "Main" }).style.getPropertyValue("--i");

  it.each([
    // the phone bar: Home, Courses, Materials, Inbox, More
    ["a student on Materials", "student", "/resources", "2"],
    ["a student on Routine, in More", "student", "/routine", "4"],
    ["a mod on the panel, in More", "mod", "/mod/queue", "4"],
  ] as const)("sits at the active tab's position for %s", async (_who, role, path, at) => {
    await renderShell(user(role), path);
    expect(index()).toBe(at);
    expect(pill().hasAttribute("data-hidden")).toBe(false);
  });

  it("hides when no tab is active, for example while changing the password", async () => {
    await renderShell(user("mod"), "/change-password");
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

  it("closes at once when collapsed with the mouse, even though the pointer is still on it", async () => {
    await renderShell(user("student"));
    const rail = screen.getByRole("complementary", { name: "Sidebar" });
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }), { detail: 1 });

    expect(rail.getAttribute("data-collapsed")).toBe("true");
    expect(rail.getAttribute("data-expanded")).toBe("false");
  });

  it("keeps tab link names available when collapsed", async () => {
    await renderShell(user("student"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    for (const label of ["Home", "Courses", "Materials", "Rides", "Routine", "Inbox", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  });

  it("hides tab labels only on the rail when collapsed, never on the phone tab bar", async () => {
    localStorage.setItem("unilink-rail", "collapsed");
    await renderShell(user("student"));

    const label = screen.getByText("Home");
    expect(label.classList.contains("sr-only")).toBe(false);
    expect(label.classList.contains("md:sr-only")).toBe(true);
  });
});
