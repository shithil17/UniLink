// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideAreaCounts, RideDetail, RideSummary } from "../../shared/schemas/rides";
import { liveMaps, Marker, resetFakeMaps } from "@/test/fakeMapLibre";
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

/** The one ride in Jatrabari's list, told apart from the others by its landmark. */
const JATRABARI_RIDE = ride({ id: 7, pickupLandmark: "Jatrabari bridge" });

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
  // The feed with no filter and with a vehicle filter, and one list per area an area's rides ask for.
  const feeds: [Record<string, unknown>, RideSummary][] = [
    [{}, ride()],
    [{ vehicle: "bike" }, ride()],
    [{ from: 70 }, JATRABARI_RIDE],
    [{ to: 70 }, ride()],
    [{ from: 1 }, ride()],
    [{ to: 1 }, ride({ id: 8, destinationLandmark: "North gate" })],
  ];
  for (const [filters, item] of feeds) {
    queryClient.setQueryData(["rides", "feed", filters], {
      pages: [{ items: [item], nextCursor: null }],
      pageParams: [""],
    });
  }
  // The open ride: an exact pickup pin, and the destination at its area's point.
  queryClient.setQueryData(["rides", "detail", JATRABARI_RIDE.id], {
    ...JATRABARI_RIDE,
    pickupPoint: { lat: 23.7121, lng: 90.4352 },
    destinationPoint: null,
  } satisfies RideDetail);
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

/** What the one map has on it right now: the count pills' labels and the ride's pins and circles. */
function shown() {
  const live = Marker.instances.filter((m) => !m.removed);
  const pills = live
    .map((m) => m.element.querySelector("button")?.getAttribute("aria-label"))
    .filter((label): label is string => Boolean(label));
  const trip = live
    .filter((m) => m.element.getAttribute("role") === "img")
    .map((m) => m.element.getAttribute("aria-label") ?? "");
  return { pills, trip };
}

/** The padding of the map's latest fit. */
function fit(map: ReturnType<typeof liveMaps>[number]) {
  const options = map.called("fitBounds").at(-1)?.args[1] as {
    padding: { top: number; right: number; bottom: number; left: number };
  };
  return options.padding;
}

const back = (router: ReturnType<typeof renderAt>) =>
  act(async () => {
    router.history.back();
  });

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

  it("below lg a filter picked in the map's sheet stays when the map closes", async () => {
    const router = renderAt("/rides", { phone: true });
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    await screen.findByRole("dialog", { name: "Map of rides by area" });
    await pill("Jatrabari, 6 rides");
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bike" }));
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", vehicle: "bike" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close the map" }));
    // Going back would restore the entry from before the filter; the map closes in place instead.
    await waitFor(() => expect(router.state.location.search).toEqual({ vehicle: "bike" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Remove filter: Bike" })).toBeTruthy();
  });

  it("below lg leaving for the list over open layers closes them for good: Back does not reopen them", async () => {
    const router = renderAt("/rides", { phone: true });
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    fireEvent.click(await screen.findByRole("button", { name: /Jatrabari bridge/ }));
    await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" });

    // The tab sits behind the sheets, so a test reaches it directly.
    fireEvent.click(screen.getByRole("tab", { name: "List", hidden: true }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await back(router);
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("opens a card when a count is tapped, and its button opens that area's rides over the map, which stays", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    expect(await screen.findByText("Jatrabari: 6 rides leaving")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Jatrabari, 6 rides" }).getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show these rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    // A sheet over the map: titled with the area and the count, listing that area's rides (the
    // `from` feed, whose ride has its own landmark), and the one map is still there behind it.
    expect(await screen.findByRole("dialog", { name: "Leaving Jatrabari · 6 rides" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Jatrabari \(Jatrabari bridge\) to Bashundhara/ }),
    ).toBeTruthy();
    expect(liveMaps()).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/rides");
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
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "destination-1" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Going to Bashundhara R/A · 9 rides" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /North gate/ })).toBeTruthy();
  });

  it("shows how many rides are not on the map, and the chip leaves the map for the list (below lg)", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    const chip = await screen.findByRole("button", { name: "Not on the map: 2 rides" });
    fireEvent.click(chip);
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("from lg the map fills the content area with no list beside it, not as a dialog", async () => {
    const router = renderAt("/rides?view=map");
    await pill("Jatrabari, 6 rides");
    expect(screen.queryByRole("dialog")).toBeNull();
    // No list, no "pick a ride" prompt, no expand button; the filter bar and its List / Map control stay.
    expect(screen.queryByRole("link", { name: /Jatrabari/ })).toBeNull();
    expect(screen.queryByText("Pick a ride to see the details")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open the map full screen" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Map" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leaving from" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not on the map: 2 rides" })).toBeTruthy();
    expect(liveMaps()).toHaveLength(1);
    expect(countCalls).toEqual(["/api/rides/areas?by=pickup"]);

    // Back to the list through the control, with the list returning beside the prompt.
    fireEvent.click(screen.getByRole("tab", { name: "List" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("link", { name: /Jatrabari/ })).toBeTruthy();
    expect(liveMaps()).toHaveLength(0);
  });

  it("from lg the 'Not on the map' chip leaves the map for the list", async () => {
    const router = renderAt("/rides?view=map");
    fireEvent.click(await screen.findByRole("button", { name: "Not on the map: 2 rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("link", { name: /Jatrabari/ })).toBeTruthy();
  });

  it("from lg a count opens a card, its button docks the rides panel and a ride docks its detail over it, on one map", async () => {
    const router = renderAt("/rides");
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    expect(await screen.findByText("Jatrabari: 6 rides leaving")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show these rides" }));
    const rides = await screen.findByRole("region", { name: "Rides in this area" });
    expect(rides.textContent).toContain("Leaving Jatrabari · 6 rides");
    expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // The map and its pills are still in reach beside the panel.
    expect(liveMaps()).toHaveLength(1);
    expect(shown().pills).toContain("Jatrabari, 6 rides");

    fireEvent.click(within(rides).getByRole("button", { name: /Jatrabari bridge/ }));
    const detail = await screen.findByRole("region", { name: "Ride details" });
    expect(router.state.location.search).toEqual({
      view: "map",
      area: "pickup-70",
      ride: JATRABARI_RIDE.id,
    });
    expect(within(detail).getByRole("link", { name: "Open in Maps" })).toBeTruthy();
    // The rides panel stays mounted underneath, held out of reach; the same one map draws the ride.
    expect(rides.isConnected).toBe(true);
    expect(rides.hasAttribute("inert")).toBe(true);
    expect(liveMaps()).toHaveLength(1);
    expect(shown().pills).toEqual([]);
    expect(shown().trip).toEqual(["Pickup, Jatrabari", "Destination, around bashundhara r/a"]);
    // Fitted with room kept on the right for the docked panel.
    const padding = fit(liveMaps()[0]);
    expect(padding.right).toBeGreaterThan(padding.left);

    // Back, one layer at a time: detail, then the rides, then the map's entry, then the list.
    await back(router);
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    expect(screen.queryByRole("region", { name: "Ride details" })).toBeNull();
    expect(rides.hasAttribute("inert")).toBe(false);
    await waitFor(() => expect(shown().pills).toContain("Jatrabari, 6 rides"));
    expect(shown().trip).toEqual([]);
    await back(router);
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));
    expect(screen.queryByRole("region", { name: "Rides in this area" })).toBeNull();
    expect(liveMaps()).toHaveLength(1);
  });

  it("from lg a filter picked while an area's rides are open stays when the panel closes", async () => {
    const router = renderAt("/rides");
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    await screen.findByRole("region", { name: "Rides in this area" });

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bike" }));
    fireEvent.click(screen.getByRole("button", { name: "Show rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        view: "map",
        area: "pickup-70",
        vehicle: "bike",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close the rides" }));
    // Going back would restore the entry from before the filter; the panel closes in place instead.
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", vehicle: "bike" }),
    );
    expect(screen.queryByRole("region", { name: "Rides in this area" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove filter: Bike" })).toBeTruthy();
  });

  it("from lg leaving for the list closes the layers for good: Back does not reopen the ride panel", async () => {
    const router = renderAt("/rides");
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    const rides = await screen.findByRole("region", { name: "Rides in this area" });
    fireEvent.click(within(rides).getByRole("button", { name: /Jatrabari bridge/ }));
    await screen.findByRole("region", { name: "Ride details" });

    fireEvent.click(screen.getByRole("tab", { name: "List" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("link", { name: /Jatrabari/ })).toBeTruthy();

    await back(router);
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole("region", { name: "Ride details" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Rides in this area" })).toBeNull();
  });

  it("from lg a ride over an area's rides has a back arrow in place of a close button, and it returns to the rides", async () => {
    const router = renderAt("/rides?view=map");
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    const rides = await screen.findByRole("region", { name: "Rides in this area" });
    fireEvent.click(within(rides).getByRole("button", { name: /Jatrabari bridge/ }));
    const detail = await screen.findByRole("region", { name: "Ride details" });
    await waitFor(() => expect(shown().trip).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Close the ride" })).toBeNull();
    // The rides panel under it keeps its own close button.
    expect(rides.hasAttribute("inert")).toBe(true);

    fireEvent.click(within(detail).getByRole("button", { name: "Back to Jatrabari rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ride details" })).toBeNull());
    expect(rides.hasAttribute("inert")).toBe(false);
    expect(within(rides).getByRole("button", { name: "Close the rides" })).toBeTruthy();
    await waitFor(() => expect(shown().pills).toContain("Jatrabari, 6 rides"));
    expect(shown().trip).toEqual([]);
  });

  it("from lg Escape closes only the top docked panel", async () => {
    const router = renderAt("/rides?view=map");
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    const rides = await screen.findByRole("region", { name: "Rides in this area" });
    fireEvent.click(within(rides).getByRole("button", { name: /Jatrabari bridge/ }));
    const detail = await screen.findByRole("region", { name: "Ride details" });

    fireEvent.keyDown(detail, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ride details" })).toBeNull());
    expect(screen.getByRole("region", { name: "Rides in this area" })).toBeTruthy();
    expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" });
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

describe("Rides Map view layers below lg", () => {
  it("a ride opens its detail over the rides sheet on the one map, and Back unwinds the layers in order", async () => {
    const router = renderAt("/rides", { phone: true });
    fireEvent.click(await screen.findByRole("tab", { name: "Map" }));
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    const row = await screen.findByRole("button", { name: /Jatrabari bridge/ });
    expect(shown().pills).toContain("Jatrabari, 6 rides");

    fireEvent.click(row);
    // The detail sheet is stacked over the rides sheet, and the map behind draws the ride: the same
    // single map, no second one from the detail, the count pills gone meanwhile.
    expect(
      await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" }),
    ).toBeTruthy();
    expect(router.state.location.search).toEqual({
      view: "map",
      area: "pickup-70",
      ride: JATRABARI_RIDE.id,
    });
    expect(screen.getByRole("link", { name: "Open in Maps" }).getAttribute("href")).toContain(
      "google.com/maps/dir/?api=1&origin=23.7121,90.4352&destination=23.8151,90.4253",
    );
    expect(liveMaps()).toHaveLength(1);
    await waitFor(() =>
      expect(shown().trip).toEqual(["Pickup, Jatrabari", "Destination, around bashundhara r/a"]),
    );
    expect(shown().pills).toEqual([]);
    // Fitted with the bottom kept clear for the sheet.
    const padding = fit(liveMaps()[0]);
    expect(padding.bottom).toBeGreaterThan(padding.top);

    // Back closes the detail only: the rides sheet is still there, the same row (so its scroll is
    // kept), and the pills are back on the map.
    await back(router);
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    await waitFor(() => expect(shown().pills).toContain("Jatrabari, 6 rides"));
    expect(shown().trip).toEqual([]);
    expect(row.isConnected).toBe(true);
    expect(liveMaps()).toHaveLength(1);

    // Then the rides sheet, leaving the map with its card, then the map.
    await back(router);
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Leaving Jatrabari · 6 rides" })).toBeNull(),
    );
    expect(await screen.findByText("Jatrabari: 6 rides leaving")).toBeTruthy();
    expect(liveMaps()).toHaveLength(1);
    await back(router);
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(liveMaps()).toHaveLength(0));
  });

  it("a ride over an area's rides has a back arrow in place of a close button, and it returns to the rides", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    const row = await screen.findByRole("button", { name: /Jatrabari bridge/ });
    fireEvent.click(row);
    const detail = await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" });
    await waitFor(() => expect(shown().trip).toHaveLength(2));
    expect(within(detail).queryByRole("button", { name: "Close" })).toBeNull();

    fireEvent.click(within(detail).getByRole("button", { name: "Back to Jatrabari rides" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Jatrabari to Bashundhara R/A" })).toBeNull(),
    );
    expect(await screen.findByRole("dialog", { name: "Leaving Jatrabari · 6 rides" })).toBeTruthy();
    // The same row, so the list kept its scroll.
    expect(row.isConnected).toBe(true);
    await waitFor(() => expect(shown().pills).toContain("Jatrabari, 6 rides"));
    expect(shown().trip).toEqual([]);
  });

  it("a reload on a ride has nothing to go back to, so its detail keeps the close button", async () => {
    renderAt(`/rides?view=map&ride=${JATRABARI_RIDE.id}`, { phone: true });
    const detail = await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" });
    expect(within(detail).getByRole("button", { name: "Close" })).toBeTruthy();
    expect(within(detail).queryByRole("button", { name: /^Back to/ })).toBeNull();
  });

  it("Escape closes only the top sheet", async () => {
    const router = renderAt("/rides?view=map", { phone: true });
    fireEvent.click(await pill("Jatrabari, 6 rides"));
    fireEvent.click(await screen.findByRole("button", { name: "Show these rides" }));
    fireEvent.click(await screen.findByRole("button", { name: /Jatrabari bridge/ }));
    await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" });

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: "map", area: "pickup-70" }),
    );
    expect(await screen.findByRole("dialog", { name: "Leaving Jatrabari · 6 rides" })).toBeTruthy();
  });

  it("a reload on a ride opens its detail over the map, and closing it returns to the map", async () => {
    const router = renderAt(`/rides?view=map&ride=${JATRABARI_RIDE.id}`, { phone: true });
    expect(
      await screen.findByRole("dialog", { name: "Jatrabari to Bashundhara R/A" }),
    ).toBeTruthy();
    await waitFor(() => expect(shown().trip).toHaveLength(2));
    expect(liveMaps()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // Nothing to go back to inside the app, so the entry is replaced without the ride.
    await waitFor(() => expect(router.state.location.search).toEqual({ view: "map" }));
    await waitFor(() => expect(shown().pills).toContain("Jatrabari, 6 rides"));
  });

  it("a reload on an area's rides opens them in that direction, with the area's pill selected", async () => {
    renderAt("/rides?view=map&area=destination-1", { phone: true });
    expect(
      await screen.findByRole("dialog", { name: "Going to Bashundhara R/A · 9 rides" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /North gate/ })).toBeTruthy();
    await waitFor(() => expect(shown().pills).toContain("Bashundhara R/A, 9 rides"));
  });

  it("drops the layers from a URL that is not in the Map view", async () => {
    const router = renderAt("/rides?area=pickup-70&ride=7", { phone: true });
    await screen.findByRole("link", { name: /Jatrabari/ });
    expect(router.state.location.search).toEqual({});
  });
});
