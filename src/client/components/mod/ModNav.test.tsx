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

  it("lists every section a mod can open in the sheet, with the current one marked", async () => {
    await renderAt("/mod/courses", "mod");
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    const sheet = await screen.findByRole("navigation", { name: "Moderation sections" });
    const links = within(sheet).getAllByRole("link");
    expect(links).toHaveLength(modSectionsFor("mod").length);
    expect(links.map((l) => l.getAttribute("aria-current")).filter(Boolean)).toEqual(["page"]);
    expect(within(sheet).queryByRole("link", { name: /Audit log/ })).toBeNull();
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

  it("lists the audit log only for admins, in the tab row as well as the sheet, and marks the current section", async () => {
    await renderAt("/mod/audit", "mod");
    const modRow = screen.getAllByRole("navigation", { name: "Moderation" })[0]!;
    expect(within(modRow).queryByRole("link", { name: "Audit log" })).toBeNull();
    cleanup();

    await renderAt("/mod/audit", "admin");
    const row = screen.getAllByRole("navigation", { name: "Moderation" })[0]!;
    const audit = within(row).getByRole("link", { name: "Audit log" });
    expect(audit.getAttribute("aria-current")).toBe("page");
    const others = within(row)
      .getAllByRole("link")
      .filter((l) => l !== audit);
    expect(others).toHaveLength(modSectionsFor("admin").length - 1);
    expect(others.every((l) => l.getAttribute("aria-current") === null)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Audit log" }));
    const sheet = await screen.findByRole("navigation", { name: "Moderation sections" });
    expect(within(sheet).getByRole("link", { name: /Audit log/ })).toBeTruthy();
  });
});
