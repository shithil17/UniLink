// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideFeedPage, RideSummary } from "../../shared/schemas/rides";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

const FRI_0730 = Date.UTC(2026, 10, 20, 1, 30);

const ride = (over: Partial<RideSummary> = {}): RideSummary => ({
  id: 1,
  kind: "one_off",
  pickupArea: { id: 1, name: "Bashundhara R/A" },
  destinationArea: { id: 60, name: "Mirpur" },
  pickupLandmark: "NSU gate",
  destinationLandmark: "Mirpur 10",
  vehicle: "car",
  totalSeats: 4,
  seatsRemaining: 3,
  pricePerSeatTaka: 150,
  notes: null,
  departsAt: FRI_0730,
  days: null,
  departureTime: null,
  endsOn: null,
  state: "open",
  status: "published",
  expiresAt: FRI_0730,
  createdAt: FRI_0730 - 1000,
  mine: false,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(
  path: string,
  feeds: { filters: object; page: RideFeedPage }[],
  mine: RideFeedPage = { items: [], nextCursor: null },
) {
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
  for (const { filters, page } of feeds) {
    queryClient.setQueryData(["rides", "feed", filters], { pages: [page], pageParams: [""] });
  }
  queryClient.setQueryData(
    ["areas"],
    [
      { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", children: [] },
      {
        id: 60,
        slug: "mirpur",
        name: "Mirpur",
        children: [{ id: 61, slug: "mirpur-mirpur-10", name: "Mirpur 10" }],
      },
    ],
  );
  queryClient.setQueryData(["rides", "mine"], { pages: [mine], pageParams: [""] });
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

describe("Rides screen", () => {
  it("lists rides with route, schedule, price and seats, and never a contact", async () => {
    renderAt("/rides", [
      {
        filters: {},
        page: {
          items: [
            ride({ id: 1 }),
            ride({
              id: 2,
              kind: "recurring",
              pickupArea: { id: 60, name: "Mirpur" },
              destinationArea: { id: 1, name: "Bashundhara R/A" },
              pickupLandmark: null,
              destinationLandmark: "NSU gate",
              departsAt: null,
              days: ["sun", "mon", "tue", "wed", "thu"],
              departureTime: "07:30",
              endsOn: "2027-01-19",
              vehicle: "bike",
              seatsRemaining: 0,
              state: "full",
            }),
          ],
          nextCursor: null,
        },
      },
    ]);
    const rows = await screen.findAllByRole("link", { name: /Bashundhara R\/A/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.getAttribute("href")).toBe("/rides/1");
    expect(rows[0]!.textContent).toContain("Bashundhara R/A (NSU gate)");
    expect(rows[0]!.textContent).toContain("Mirpur (Mirpur 10)");
    expect(rows[1]!.textContent).not.toContain("Mirpur ()");
    expect(rows[0]!.textContent).toContain("Fri 20 Nov, 7:30 am");
    expect(rows[0]!.textContent).toContain("150 taka a seat");
    expect(rows[0]!.textContent).toContain("3 of 4 seats left");
    expect(rows[1]!.textContent).toContain("Sun to Thu at 7:30 am");
    expect(rows[1]!.textContent).toContain("Full");
    // Contacts exist only behind "Show contact" on the detail.
    expect(document.body.textContent).not.toMatch(/\+8801|wa\.me|m\.me|tel:/);
    expect(screen.getByText(/doesn't arrange or guarantee rides/)).toBeTruthy();
  });

  it("reads its filters from the URL and offers to clear them when nothing matches", async () => {
    const router = renderAt("/rides?vehicle=bike&day=mon", [
      { filters: { vehicle: "bike", day: "mon" }, page: { items: [], nextCursor: null } },
      { filters: {}, page: { items: [ride()], nextCursor: null } },
    ]);
    expect(await screen.findByText("No rides match.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filters\s*2/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("link", { name: /Bashundhara R\/A/ })).toBeTruthy();
  });

  it("filters by area from the URL: names them in the sheet, suggests a broader area when empty, and clears one chip at a time", async () => {
    const router = renderAt("/rides?from=1&to=61", [
      { filters: { from: 1, to: 61 }, page: { items: [], nextCursor: null } },
      { filters: { to: 61 }, page: { items: [ride()], nextCursor: null } },
    ]);
    expect(await screen.findByText("No rides match.")).toBeTruthy();
    expect(screen.getByText(/Try a broader area/)).toBeTruthy();
    // The chips are there without opening anything.
    fireEvent.click(screen.getByRole("button", { name: /Filters\s*2/ }));
    // The sheet names both areas in their pickers.
    expect((await screen.findByLabelText("From")).textContent).toContain("Bashundhara R/A");
    expect(screen.getByLabelText("To").textContent).toContain("Mirpur 10");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove filter: From Bashundhara R/A" }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({ to: 61 }));
    expect(await screen.findByRole("link", { name: /Bashundhara R\/A/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter: To Mirpur 10" })).toBeTruthy();
  });

  it("opens the filters as a sheet over the page: chips and list stay, nothing applies until Show rides", async () => {
    const router = renderAt("/rides?vehicle=bike", [
      { filters: { vehicle: "bike" }, page: { items: [ride()], nextCursor: null } },
      { filters: { vehicle: "bike", day: "mon" }, page: { items: [], nextCursor: null } },
    ]);
    const button = await screen.findByRole("button", { name: /Filters/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBeNull();

    fireEvent.click(button);
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(sheet.id);
    // The page behind keeps its chip row and its list: no inline panel pushed them around.
    // (The modal hides them from the accessibility tree, so look them up with `hidden`.)
    expect(screen.getByRole("list", { name: "Active filters", hidden: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Bashundhara R\/A/, hidden: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    // A draft: the URL has not changed yet.
    expect(router.state.location.search).toEqual({ vehicle: "bike" });
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ vehicle: "bike", day: "mon" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("button", { name: "Remove filter: Monday" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter: Bike" })).toBeTruthy();
  });

  it("Clear in the sheet empties the draft and Show rides drops every sheet filter", async () => {
    const router = renderAt("/rides?vehicle=bike&day=mon&q=gate", [
      {
        filters: { vehicle: "bike", day: "mon", q: "gate" },
        page: { items: [], nextCursor: null },
      },
      { filters: { q: "gate" }, page: { items: [ride()], nextCursor: null } },
    ]);
    fireEvent.click(await screen.findByRole("button", { name: /Filters\s*2/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Bike" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));
    // The search text stays: it lives outside the sheet.
    await waitFor(() => expect(router.state.location.search).toEqual({ q: "gate" }));
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  it("keeps the previous rides on screen, dimmed, while the next filter loads", async () => {
    renderAt("/rides", [{ filters: {}, page: { items: [ride()], nextCursor: null } }]);
    expect(await screen.findByRole("link", { name: /Bashundhara R\/A/ })).toBeTruthy();

    let resolve!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bike" }));
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));

    // The request is out; the old row is still there and no spinner replaced it.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove filter: Bike" })).toBeTruthy(),
    );
    const row = screen.getByRole("link", { name: /Bashundhara R\/A/ });
    expect(row.closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("status", { name: "Loading rides" })).toBeNull();

    resolve(
      Response.json({
        items: [ride({ id: 9, pickupArea: { id: 60, name: "Mirpur" }, vehicle: "bike" })],
        nextCursor: null,
      }),
    );
    expect(await screen.findByRole("link", { name: /^Mirpur/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Bashundhara R\/A/ })).toBeNull();
  });

  it("picks an area in the filter sheet and applies it with Show rides", async () => {
    const router = renderAt("/rides?vehicle=bike", [
      { filters: { vehicle: "bike" }, page: { items: [], nextCursor: null } },
      { filters: { vehicle: "bike", to: 60 }, page: { items: [], nextCursor: null } },
    ]);
    fireEvent.click(await screen.findByRole("button", { name: /Filters/ }));
    fireEvent.click(await screen.findByLabelText("To"));
    fireEvent.click(await screen.findByRole("option", { name: "Mirpur" }));
    // The area sheet closes; the filter sheet stays, with the pick in the draft.
    expect((await screen.findByLabelText("To")).textContent).toContain("Mirpur");
    expect(router.state.location.search).toEqual({ vehicle: "bike" });
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ vehicle: "bike", to: 60 }));
  });

  it("shows My rides with the expiry words and says what a held or ended ride is", async () => {
    const router = renderAt("/rides", [{ filters: {}, page: { items: [], nextCursor: null } }], {
      items: [
        ride({ id: 3, mine: true, status: "pending_review" }),
        ride({ id: 4, mine: true, state: "expired" }),
      ],
      nextCursor: null,
    });
    fireEvent.click(await screen.findByRole("tab", { name: "My rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: "mine" }));
    expect(await screen.findByText("Waiting for a moderator")).toBeTruthy();
    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.getByText(/disappears from the feed when it departs/)).toBeTruthy();
    expect(screen.getByText(/gone for everyone right away/)).toBeTruthy();
  });
});
