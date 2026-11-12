// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideAreaCounts, RideSummary } from "../../shared/schemas/rides";
import { resetFakeMaps } from "@/test/fakeMapLibre";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));
vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));

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
  pickupArea: { id: 70, name: "Jatrabari" },
  destinationArea: { id: 1, name: "Bashundhara R/A" },
  pickupLandmark: null,
  destinationLandmark: "NSU gate",
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

const AREAS = [
  {
    id: 1,
    slug: "bashundhara-r-a",
    name: "Bashundhara R/A",
    lat: 23.8151,
    lng: 90.4253,
    children: [],
  },
  {
    id: 60,
    slug: "mirpur",
    name: "Mirpur",
    lat: 23.8223,
    lng: 90.3654,
    children: [{ id: 61, slug: "mirpur-10", name: "Mirpur 10", lat: 23.8069, lng: 90.3685 }],
  },
  { id: 70, slug: "jatrabari", name: "Jatrabari", lat: 23.7104, lng: 90.4348, children: [] },
  { id: 80, slug: "outside-dhaka", name: "Outside Dhaka", lat: null, lng: null, children: [] },
];

const COUNTS: Record<"pickup" | "destination", RideAreaCounts["areas"]> = {
  pickup: [
    { areaId: 1, count: 1 },
    { areaId: 60, count: 2 },
    { areaId: 61, count: 1 },
    { areaId: 70, count: 6 },
    { areaId: 80, count: 2 },
  ],
  destination: [
    { areaId: 1, count: 9 },
    { areaId: 60, count: 3 },
  ],
};

let countCalls: string[] = [];

beforeEach(() => {
  resetFakeMaps();
  countCalls = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** `phone` is a viewport below `lg`, where the Map view is a full-screen map; the default is a wide one. */
function renderAt(path: string, { phone = false }: { phone?: boolean } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? !phone : true,
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
    vi.fn((input: string) => {
      if (input.startsWith("/api/rides/areas")) {
        countCalls.push(input);
        const by = new URL(input, "http://x").searchParams.get("by") ?? "pickup";
        const body = { by, areas: COUNTS[by as "pickup" | "destination"] };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error("No network in this test"));
    }),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  queryClient.setQueryData(["areas"], AREAS);
  // The feed with no filter, with a vehicle filter, and filtered to Jatrabari or to Bashundhara.
  for (const filters of [{}, { vehicle: "bike" }, { from: 70 }, { to: 70 }, { from: 1 }]) {
    queryClient.setQueryData(["rides", "feed", filters], {
      pages: [{ items: [ride()], nextCursor: null }],
      pageParams: [""],
    });
  }
  queryClient.setQueryData(["rides", "mine"], {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [""],
  });
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

const pill = (name: string) => screen.findByRole("button", { name });

describe("Rides Map view", () => {
  it("switches between List and Map and keeps the filters, below lg as a full-screen map with Back", async () => {
    const router = renderAt("/rides?vehicle=bike", { phone: true });
    expect(await screen.findByRole("link", { name: /Jatrabari/ })).toBeTruthy();
    const list = screen.getByRole("tab", { name: "List" });
    expect(list.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Map" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ vehicle: "bike", view: "map" }),
    );
    expect(await screen.findByRole("dialog", { name: "Map of rides by area" })).toBeTruthy();
    // The counts follow the same filter as the list, and only the Map view asks for them.
    await pill("Jatrabari, 6 rides");
    expect(countCalls).toEqual(["/api/rides/areas?by=pickup&vehicle=bike"]);

    // Back from the full-screen map returns to the list with the filter still on.
    fireEvent.click(screen.getByRole("button", { name: "Close the map" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ vehicle: "bike" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Remove filter: Bike" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "List" }).getAttribute("aria-selected")).toBe("true");
  });

  it("does not ask for counts while the list is showing", async () => {
    renderAt("/rides");
    await screen.findByRole("link", { name: /Jatrabari/ });
    expect(countCalls).toEqual([]);
  });

  it("draws a labelled count button per area, with 1 ride in the singular", async () => {
    renderAt("/rides?view=map", { phone: true });
    const jatrabari = await pill("Jatrabari, 6 rides");
    expect(jatrabari.textContent).toBe("6");
    expect(jatrabari.tagName).toBe("BUTTON");
    expect(await pill("Bashundhara R/A, 1 ride")).toBeTruthy();
    // No point for Outside Dhaka: it is a chip, not a pill.
    expect(screen.queryByRole("button", { name: /Outside Dhaka/ })).toBeNull();
  });

  it("opens a card when a count is tapped and its button shows the list filtered to that area (below lg)", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    expect(await screen.findByText("Jatrabari: 6 rides leaving")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Jatrabari, 6 rides" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show these rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ from: 70 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Remove filter: From Jatrabari" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Jatrabari/ })).toBeTruthy();
  });

  it("tells the card's reader when the list filter also covers sub-areas that have a pill of their own", async () => {
    renderAt("/rides?view=map", { phone: true });
    fireEvent.click(await pill("Mirpur, 2 rides"));
    expect(await screen.findByText("Mirpur: 2 rides leaving")).toBeTruthy();
    expect(screen.getByText("Includes rides in 1 nearby sub-area in the list.")).toBeTruthy();

    // An area with no such sub-area keeps the line, empty, so the card does not change size.
    fireEvent.click(screen.getByRole("button", { name: "Jatrabari, 6 rides" }));
    expect(await screen.findByText("Jatrabari: 6 rides leaving")).toBeTruthy();
    expect(screen.queryByText(/nearby sub-area/)).toBeNull();
  });

  it("switches between Leaving from and Going to, which changes what is counted and the filter it sets", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    await pill("Jatrabari, 6 rides");
    expect(screen.getByRole("button", { name: "Leaving from" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Going to" }));
    await pill("Mirpur, 3 rides");
    expect(countCalls.at(-1)).toBe("/api/rides/areas?by=destination");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Jatrabari/ })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Bashundhara R/A, 9 rides" }));
    expect(await screen.findByText("Bashundhara R/A: 9 rides arriving")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show these rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ to: 1 }));
  });

  it("shows how many rides are not on the map, and the chip leaves the map for the list (below lg)", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    const chip = await screen.findByRole("button", { name: "Not on the map: 2 rides" });
    fireEvent.click(chip);
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("from lg puts the map in the right column, a count filters the list beside it and the same count clears it", async () => {
    const router = renderAt("/rides?view=map");
    expect(await screen.findByRole("link", { name: /Jatrabari/ })).toBeTruthy();
    // In the column, not a dialog; the list is still beside it.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Pick a ride to see the details")).toBeNull();

    const count = await pill("Jatrabari, 6 rides");
    expect(count.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(count);
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map", from: 70 }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Jatrabari, 6 rides" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    // Counts ignore the area filter, so picking one does not change them.
    expect(countCalls).toEqual(["/api/rides/areas?by=pickup"]);

    fireEvent.click(screen.getByRole("button", { name: "Jatrabari, 6 rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));
    expect(
      screen.getByRole("button", { name: "Jatrabari, 6 rides" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("from lg the expand button opens the same map full screen and Back closes it", async () => {
    const router = renderAt("/rides?view=map");
    await pill("Jatrabari, 6 rides");
    fireEvent.click(screen.getByRole("button", { name: "Open the map full screen" }));
    expect(await screen.findByRole("dialog", { name: "Map of rides by area" })).toBeTruthy();
    expect(router.state.location.search).toEqual({ view: "map", map: "areas" });

    fireEvent.click(screen.getByRole("button", { name: "Close the map" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("the floating Filters button opens the filter sheet over the full-screen map", async () => {
    renderAt("/rides?view=map", { phone: true });
    await pill("Jatrabari, 6 rides");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    });
    expect(await screen.findByRole("dialog", { name: "Filters" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show rides" })).toBeTruthy();
  });
});
