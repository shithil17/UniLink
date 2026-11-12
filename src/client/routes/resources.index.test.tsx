// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type {
  HelpableResourceRequest,
  HelpableResourceRequestList,
} from "../../shared/schemas/resources";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

const item = (over: Partial<HelpableResourceRequest> = {}): HelpableResourceRequest => ({
  id: 1,
  courseCode: "BIO103",
  facultyId: 7,
  faculty: { name: "Samia Rahman", initials: "SMDA" },
  note: "Midterm notes please",
  status: "published",
  state: "open",
  expiresAt: Date.now() + 3 * 86_400_000 + 60_000,
  fulfilledAt: null,
  createdAt: Date.now() - 60_000,
  sameFaculty: false,
  myLinks: 0,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string, helpable: HelpableResourceRequestList | Error) {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("No network in this test"))),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  queryClient.setQueryData(["resources", "mine"], {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [""],
  });
  if (!(helpable instanceof Error)) queryClient.setQueryData(["resources", "helpable"], helpable);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("Materials screen", () => {
  it("opens on My requests, with the purge note, and counts requests still waiting on the other tab", async () => {
    renderAt("/resources", {
      items: [item({ id: 1 }), item({ id: 2 }), item({ id: 3, myLinks: 1 })],
    });
    expect(await screen.findByRole("heading", { name: "Materials" })).toBeTruthy();
    const mine = screen.getByRole("tab", { name: "My requests" });
    expect(mine.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/A request that expires without an accepted link/)).toBeTruthy();
    // Two of the three have no link from this student yet.
    expect(screen.getByRole("tab", { name: /^Help others\s*2 waiting$/ })).toBeTruthy();
  });

  it("shows the helpable rows from the tab search param and switches back to My requests", async () => {
    const router = renderAt("/resources?tab=help", {
      items: [
        item({
          id: 1,
          sameFaculty: true,
          myLinks: 2,
          note: "Midterm notes please",
          expiresAt: Date.now() + 3 * 86_400_000 + 60_000,
        }),
        item({ id: 2, courseCode: "CSE115", faculty: null, facultyId: null, note: null }),
      ],
    });
    const rows = await screen.findAllByRole("link", { name: /BIO103|CSE115/ });
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("href")).toBe("/resources/1");
    expect(rows[0].textContent).toContain("Midterm notes please");
    expect(rows[0].textContent).toContain("Same faculty");
    expect(rows[0].textContent).toContain("3 days left");
    expect(rows[0].textContent).toContain("You sent 2 links");
    expect(rows[1].textContent).not.toContain("Same faculty");
    expect(rows[1].textContent).not.toContain("You sent");
    // The purge note belongs to My requests only.
    expect(screen.queryByText(/A request that expires without an accepted link/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "My requests" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText(/A request that expires without an accepted link/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /^Help others/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: "help" }));
  });

  it("says so when there is nothing to help with", async () => {
    renderAt("/resources?tab=help", { items: [] });
    expect(await screen.findByText("Nothing to help with right now.")).toBeTruthy();
    expect(screen.getByText(/Requests for courses you've recorded/)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Help others" })).toBeTruthy();
  });

  it("shows an error with a retry when the list does not load", async () => {
    renderAt("/resources?tab=help", new Error("x"));
    expect(await screen.findByText("Requests didn't load")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry|try again/i })).toBeTruthy();
  });
});
