// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { modSectionsFor } from "@/lib/nav";
import { ModNav } from "./ModNav";

afterEach(cleanup);

async function renderAt(path: string, role: "mod" | "admin") {
  const root = createRootRoute({ component: () => <ModNav role={role} /> });
  const children = modSectionsFor("admin").map((s) =>
    createRoute({ getParentRoute: () => root, path: s.to }),
  );
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole("button");
  return router;
}

describe("ModNav", () => {
  it("names the current section on the phone button and marks it in the tab row", async () => {
    await renderAt("/mod/faculty", "mod");
    const button = screen.getByRole("button", { name: "Faculty" });
    expect(button).toBeTruthy();
    const row = screen.getAllByRole("navigation", { name: "Moderation" })[0]!;
    expect(within(row).getByRole("link", { name: "Faculty" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      within(row).getByRole("link", { name: "Queue" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("offers the audit log to an admin, and closes the sheet after choosing a section", async () => {
    const router = await renderAt("/mod/queue", "admin");
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    const sheet = await screen.findByRole("navigation", { name: "Moderation sections" });
    fireEvent.click(within(sheet).getByRole("link", { name: /Audit log/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/mod/audit"));
    await waitFor(() =>
      expect(screen.queryByRole("navigation", { name: "Moderation sections" })).toBeNull(),
    );
  });

  it.each([
    ["mod", "/mod/courses", "Courses", false],
    ["admin", "/mod/audit", "Audit log", true],
  ] as const)(
    "lists every section a %s can open, in the tab row and the sheet, with the current one marked",
    async (role, path, current, seesAudit) => {
      await renderAt(path, role);
      const sections = modSectionsFor(role);
      const row = screen.getAllByRole("navigation", { name: "Moderation" })[0]!;
      const rowLinks = within(row).getAllByRole("link");
      expect(rowLinks).toHaveLength(sections.length);
      expect(rowLinks.filter((l) => l.getAttribute("aria-current") === "page")).toHaveLength(1);
      expect(within(row).getByRole("link", { name: current }).getAttribute("aria-current")).toBe(
        "page",
      );
      expect(!!within(row).queryByRole("link", { name: "Audit log" })).toBe(seesAudit);

      fireEvent.click(screen.getByRole("button", { name: current }));
      const sheet = await screen.findByRole("navigation", { name: "Moderation sections" });
      const links = within(sheet).getAllByRole("link");
      expect(links).toHaveLength(sections.length);
      expect(links.map((l) => l.getAttribute("aria-current")).filter(Boolean)).toEqual(["page"]);
      expect(!!within(sheet).queryByRole("link", { name: /Audit log/ })).toBe(seesAudit);
    },
  );
});
