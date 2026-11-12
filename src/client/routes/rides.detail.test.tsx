// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideDetail } from "../../shared/schemas/rides";
import { Map as FakeMap, Marker, liveMaps, resetFakeMaps } from "@/test/fakeMapLibre";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), toasts) }));
vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

const FRI_0730 = Date.UTC(2026, 10, 20, 1, 30);

const ride = (over: Partial<RideDetail> = {}): RideDetail => ({
  id: 5,
  kind: "one_off",
  pickupArea: { id: 1, name: "Bashundhara R/A" },
  destinationArea: { id: 60, name: "Mirpur" },
  pickupLandmark: "NSU gate",
  destinationLandmark: "Mirpur 10",
  pickupPoint: null,
  destinationPoint: null,
  vehicle: "car",
  totalSeats: 4,
  seatsRemaining: 3,
  pricePerSeatTaka: 150,
  notes: "Wait at gate 2",
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

beforeEach(resetFakeMaps);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toasts.success.mockClear();
  toasts.error.mockClear();
});

const contacts = {
  phone: "+8801712345678",
  whatsapp: "https://wa.me/8801712345678",
  messenger: "https://m.me/dev.cse",
};

function renderDetail(
  detail: RideDetail,
  contactResponse: () => Response = () => Response.json({ contacts }),
  api: (path: string, init?: RequestInit) => Response | undefined = () => undefined,
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
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const response =
      path === `/api/rides/${detail.id}/contact` ? contactResponse() : api(path, init);
    return response
      ? Promise.resolve(response)
      : Promise.reject(new Error("No network in this test"));
  });
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  queryClient.setQueryData(["rides", "detail", detail.id], detail);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/rides/${detail.id}`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return Object.assign(fetchMock, { router, queryClient });
}

describe("Ride detail", () => {
  it("shows the ride and keeps the contact hidden until it is asked for", async () => {
    const fetchMock = renderDetail(ride());
    expect(await screen.findByRole("heading", { name: "Bashundhara R/A to Mirpur" })).toBeTruthy();
    expect(screen.getByText("Bashundhara R/A (NSU gate)")).toBeTruthy();
    expect(screen.getByText("Mirpur (Mirpur 10)")).toBeTruthy();
    expect(screen.getByText("Fri 20 Nov, 7:30 am")).toBeTruthy();
    expect(screen.getByText("3 of 4 seats left")).toBeTruthy();
    expect(screen.getByText("150 taka a seat")).toBeTruthy();
    expect(screen.getByText("Wait at gate 2")).toBeTruthy();
    expect(screen.getByText(/doesn't arrange or guarantee rides/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report this ride" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\+8801|wa\.me|m\.me/);
    expect(document.querySelector("a[href^='tel:']")).toBeNull();
    // Only the list behind the panel was fetched: no contact request until it is asked for.
    expect(fetchMock).not.toHaveBeenCalledWith("/api/rides/5/contact", expect.anything());
  });

  describe("the map", () => {
    const area = (id: number, name: string, lat: number | null, lng: number | null) => ({
      id,
      slug: name.toLowerCase(),
      name,
      lat,
      lng,
      children: [],
    });
    const POINTED = [
      area(1, "Bashundhara R/A", 23.8151, 90.4253),
      area(60, "Mirpur", 23.8223, 90.3654),
    ];
    const areasApi =
      (list = POINTED) =>
      (path: string) =>
        path === "/api/areas" ? Response.json(list) : undefined;
    const OPEN = { name: "Open the map of this ride" };
    const NSU_PIN = { lat: 23.8151, lng: 90.4253 };
    const MIRPUR_PIN = { lat: 23.8223, lng: 90.3654 };

    it("has no map panel when neither end has a point, and the facts stay", async () => {
      const fetchMock = renderDetail(
        ride(),
        undefined,
        areasApi([area(1, "Bashundhara R/A", null, null), area(60, "Mirpur", null, null)]),
      );
      expect(await screen.findByText("Bashundhara R/A (NSU gate)")).toBeTruthy();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/areas", expect.anything()));
      // The panel was held as a skeleton while the areas loaded, and is gone once they say no point.
      await waitFor(() => expect(document.querySelector("[data-slot=skeleton]")).toBeNull());
      expect(screen.queryByRole("button", OPEN)).toBeNull();
      expect(liveMaps()).toHaveLength(0);
    });

    it("sits above the facts and opens the full-screen map with both pins, the card and Open in Maps", async () => {
      renderDetail(ride({ pickupPoint: NSU_PIN, destinationPoint: MIRPUR_PIN }));
      const preview = await screen.findByRole("button", OPEN);
      // First panel under the title, before the facts.
      const facts = screen.getByRole("region", { name: "The ride" });
      expect(
        preview.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // The side panel is 240px tall.
      expect(preview.className).toContain("h-60");

      fireEvent.click(preview);
      const dialog = await screen.findByRole("dialog", { name: "Map of this ride" });
      const link = within(dialog).getByRole("link", { name: /Open in Maps/ });
      expect(link.getAttribute("href")).toBe(
        "https://www.google.com/maps/dir/?api=1&origin=23.8151,90.4253&destination=23.8223,90.3654",
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(within(dialog).getByText("Bashundhara R/A (NSU gate)")).toBeTruthy();
      expect(within(dialog).getByText("Mirpur (Mirpur 10)")).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Fit the ride" })).toBeTruthy();
      // Two exact pins and the dashed line between them, drawn on the one live map.
      await waitFor(() => expect(liveMaps()).toHaveLength(1));
      await waitFor(() => expect(liveMaps()[0]!.layers.has("trip-line")).toBe(true));
      expect(
        Marker.instances.filter((m) => !m.removed).map((m) => m.element.getAttribute("aria-label")),
      ).toEqual(["Pickup, Bashundhara R/A", "Destination, Mirpur"]);
      expect(screen.queryByText(/^Around /)).toBeNull();
    });

    it("closes with Back and leaves the ride as it was", async () => {
      const view = renderDetail(ride({ pickupPoint: NSU_PIN, destinationPoint: MIRPUR_PIN }));
      fireEvent.click(await screen.findByRole("button", OPEN));
      await screen.findByRole("dialog", { name: "Map of this ride" });
      expect(view.router.state.location.search).toMatchObject({ map: "ride" });

      act(() => view.router.history.back());
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Map of this ride" })).toBeNull(),
      );
      expect(view.router.state.location.pathname).toBe("/rides/5");
      expect(await screen.findByRole("button", OPEN)).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Bashundhara R/A to Mirpur" })).toBeTruthy();
    });

    it("draws the end with no pin as 'Around ...' at its area's point", async () => {
      renderDetail(ride({ pickupPoint: NSU_PIN }), undefined, areasApi());
      await screen.findByRole("button", OPEN);
      expect(await screen.findByText("Around Mirpur")).toBeTruthy();
      expect(screen.queryByText("Around Bashundhara R/A")).toBeNull();
      const markers = Marker.instances.filter((m) => !m.removed);
      expect(markers).toHaveLength(2);
      expect(markers[1]!.lngLat).toEqual([90.3654, 23.8223]);
      // The dashed line still joins the two ends.
      await waitFor(() => expect(liveMaps()[0]!.layers.has("trip-line")).toBe(true));
    });

    it("shows the unavailable state when the map cannot load, and the facts stay", async () => {
      FakeMap.failNext = true;
      renderDetail(ride({ pickupPoint: NSU_PIN, destinationPoint: MIRPUR_PIN }));
      expect(await screen.findByText(/can't load right now|unavailable offline/)).toBeTruthy();
      expect(screen.getByText("Bashundhara R/A (NSU gate)")).toBeTruthy();
    });
  });

  it("reveals the contact as real tel:, wa.me and m.me links", async () => {
    const fetchMock = renderDetail(ride());
    fireEvent.click(await screen.findByRole("button", { name: "Show contact" }));
    const call = await screen.findByRole("link", { name: /Call/ });
    expect(call.getAttribute("href")).toBe("tel:+8801712345678");
    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/8801712345678");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: /Messenger/ }).getAttribute("href")).toBe(
      "https://m.me/dev.cse",
    );
    expect(screen.queryByRole("button", { name: "Show contact" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/rides/5/contact", expect.anything());
  });

  it("keeps the button and shows no contact when the reveal is rate limited", async () => {
    renderDetail(ride(), () =>
      Response.json({ error: "rate_limited", message: "Too many attempts." }, { status: 429 }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Show contact" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Show contact" })).toBeTruthy());
    expect(document.querySelector("a[href^='tel:']")).toBeNull();
  });

  it("gives the poster their own controls, with the moderator status and no contact or report", async () => {
    renderDetail(ride({ mine: true, status: "pending_review" }));
    expect(await screen.findByText(/Waiting for a moderator/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/rides/5/edit");
    expect(screen.getByRole("button", { name: "One more seat taken" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark as full" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete this ride" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show contact" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Report this ride" })).toBeNull();
    // A one-off cannot be renewed.
    expect(screen.queryByRole("button", { name: "Renew" })).toBeNull();
  });

  describe("the poster's seat stepper", () => {
    const mine = (over: Partial<RideDetail> = {}) => ride({ mine: true, ...over });
    const taken = () => screen.getByText(/^\d+ of 4$/).textContent;
    // A tiny server for one ride: it keeps the seats it was sent and answers the refetch after a save.
    const seatsApi = (start: RideDetail = mine()) => {
      let current = start;
      return (path: string, init?: RequestInit) => {
        if (path === "/api/rides/5/seats") {
          const body = JSON.parse(init?.body as string) as { seatsRemaining: number };
          current = { ...current, seatsRemaining: body.seatsRemaining };
        } else if (path === "/api/rides/5/full") {
          current = { ...current, seatsRemaining: 0, state: "full" };
        } else if (path !== "/api/rides/5") return undefined;
        return Response.json(current);
      };
    };
    const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

    it("counts seats taken and only changes a draft until Save, which sends one request", async () => {
      const fetchMock = renderDetail(mine(), undefined, seatsApi());
      await screen.findByText("Seats taken");
      // 3 of 4 seats left is 1 taken.
      expect(taken()).toBe("1 of 4");
      fireEvent.click(button("One more seat taken"));
      fireEvent.click(button("One more seat taken"));
      fireEvent.click(button("One seat freed up"));
      expect(taken()).toBe("2 of 4");
      expect(fetchMock).not.toHaveBeenCalledWith("/api/rides/5/seats", expect.anything());

      fireEvent.click(button("Save"));
      await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("2 of 4 seats taken."));
      const posts = fetchMock.mock.calls.filter(([path]) => path === "/api/rides/5/seats");
      expect(posts).toHaveLength(1);
      expect(JSON.parse(posts[0]![1]?.body as string)).toEqual({ seatsRemaining: 2 });
      await waitFor(() => expect(button("Save").disabled).toBe(true));
      expect(taken()).toBe("2 of 4");
    });

    it("keeps Save, Cancel and Mark as full in place: Save and Cancel are disabled until the count changes, and Cancel starts over", async () => {
      renderDetail(mine(), undefined, seatsApi());
      await screen.findByText("Seats taken");
      expect(button("Save").disabled).toBe(true);
      expect(button("Cancel").disabled).toBe(true);
      expect(button("Mark as full").disabled).toBe(false);
      fireEvent.click(button("One more seat taken"));
      expect(button("Save").disabled).toBe(false);
      expect(button("Cancel").disabled).toBe(false);
      fireEvent.click(button("Cancel"));
      expect(taken()).toBe("1 of 4");
      expect(button("Save").disabled).toBe(true);
      expect(button("Cancel").disabled).toBe(true);
    });

    it("stops the stepper at none and all taken", async () => {
      renderDetail(mine({ seatsRemaining: 4 }));
      await screen.findByText("Seats taken");
      expect(button("One seat freed up").disabled).toBe(true);
      for (let i = 0; i < 4; i++) fireEvent.click(button("One more seat taken"));
      expect(taken()).toBe("4 of 4");
      expect(button("One more seat taken").disabled).toBe(true);
    });

    it("says when all seats are taken, and Mark as full stays but is disabled once the ride is full", async () => {
      renderDetail(mine({ seatsRemaining: 1 }), undefined, seatsApi(mine({ seatsRemaining: 1 })));
      await screen.findByText("Seats taken");
      fireEvent.click(button("One more seat taken"));
      fireEvent.click(button("Save"));
      await waitFor(() =>
        expect(toasts.success).toHaveBeenCalledWith(
          "All 4 seats taken. Your ride now shows as full.",
        ),
      );
      await waitFor(() => expect(button("Mark as full").disabled).toBe(true));
    });

    it("Mark as full saves full in one request and drops an unsaved draft", async () => {
      const fetchMock = renderDetail(mine(), undefined, seatsApi());
      await screen.findByText("Seats taken");
      fireEvent.click(button("One seat freed up"));
      expect(taken()).toBe("0 of 4");
      fireEvent.click(button("Mark as full"));
      await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Marked as full."));
      await waitFor(() => expect(taken()).toBe("4 of 4"));
      expect(fetchMock).not.toHaveBeenCalledWith("/api/rides/5/seats", expect.anything());
      expect(button("Save").disabled).toBe(true);
    });

    // The case from a real report: a 3-seat ride, tapped to full under the old seats-left stepper.
    describe("a 3-seat ride", () => {
      const three = (seatsRemaining: number) =>
        mine({ totalSeats: 3, seatsRemaining, state: seatsRemaining === 0 ? "full" : "open" });
      const takenOf3 = () => screen.getByText(/^\d+ of 3$/).textContent;
      const sent = (fetchMock: ReturnType<typeof renderDetail>) =>
        fetchMock.mock.calls
          .filter(([path]) => path === "/api/rides/5/seats")
          .map(([, init]) => JSON.parse(init?.body as string));

      it("starts with 0 taken, and + then Save sends 2 seats left", async () => {
        const fetchMock = renderDetail(three(3), undefined, seatsApi(three(3)));
        await screen.findByText("Seats taken");
        expect(takenOf3()).toBe("0 of 3");
        fireEvent.click(button("One more seat taken"));
        fireEvent.click(button("Save"));
        await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("1 of 3 seats taken."));
        expect(sent(fetchMock)).toEqual([{ seatsRemaining: 2 }]);
      });

      it("from full, - then Save sends 1 seat left", async () => {
        const fetchMock = renderDetail(three(0), undefined, seatsApi(three(0)));
        await screen.findByText("Seats taken");
        expect(takenOf3()).toBe("3 of 3");
        fireEvent.click(button("One seat freed up"));
        fireEvent.click(button("Save"));
        await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("2 of 3 seats taken."));
        expect(sent(fetchMock)).toEqual([{ seatsRemaining: 1 }]);
      });

      it("from full, - three times then Save empties the ride: 0 taken, 3 left", async () => {
        const fetchMock = renderDetail(three(0), undefined, seatsApi(three(0)));
        await screen.findByText("Seats taken");
        for (let i = 0; i < 3; i++) fireEvent.click(button("One seat freed up"));
        expect(takenOf3()).toBe("0 of 3");
        fireEvent.click(button("Save"));
        await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("No seats taken."));
        expect(sent(fetchMock)).toEqual([{ seatsRemaining: 3 }]);
        await waitFor(() => expect(button("Mark as full").disabled).toBe(false));
        expect(takenOf3()).toBe("0 of 3");
      });

      it("Mark as full calls the full endpoint, which the server stores as 0 seats left", async () => {
        const fetchMock = renderDetail(three(3), undefined, seatsApi(three(3)));
        await screen.findByText("Seats taken");
        fireEvent.click(button("Mark as full"));
        await waitFor(() => expect(takenOf3()).toBe("3 of 3"));
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/rides/5/full",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("keeps the draft and toasts the error when Save fails", async () => {
      renderDetail(mine(), undefined, (path) =>
        path === "/api/rides/5/seats"
          ? Response.json({ error: "conflict", message: "Try again." }, { status: 409 })
          : path === "/api/rides/5"
            ? Response.json(mine())
            : undefined,
      );
      await screen.findByText("Seats taken");
      fireEvent.click(button("One more seat taken"));
      fireEvent.click(button("Save"));
      await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("Try again."));
      expect(taken()).toBe("2 of 4");
      expect(button("Save").disabled).toBe(false);
    });

    it("follows the server while the draft is untouched, and keeps an unsaved draft when it changes", async () => {
      const view = renderDetail(mine());
      await screen.findByText("Seats taken");
      act(
        () =>
          void view.queryClient.setQueryData(["rides", "detail", 5], mine({ seatsRemaining: 1 })),
      );
      await waitFor(() => expect(taken()).toBe("3 of 4"));
      fireEvent.click(button("One seat freed up"));
      expect(taken()).toBe("2 of 4");
      act(
        () =>
          void view.queryClient.setQueryData(["rides", "detail", 5], mine({ seatsRemaining: 0 })),
      );
      await waitFor(() => expect(button("Mark as full").disabled).toBe(true));
      expect(taken()).toBe("2 of 4");
    });

    it("starts the draft over when another ride is shown", async () => {
      const first = renderDetail(mine());
      await screen.findByText("Seats taken");
      fireEvent.click(button("One more seat taken"));
      expect(taken()).toBe("2 of 4");
      first.queryClient.setQueryData(["rides", "detail", 6], mine({ id: 6, seatsRemaining: 4 }));
      await first.router.navigate({ to: "/rides/$rideId", params: { rideId: "6" } });
      await waitFor(() => expect(taken()).toBe("0 of 4"));
      expect(button("Save").disabled).toBe(true);
    });
  });

  it("lets a recurring ride be renewed and says it runs through its end date", async () => {
    renderDetail(
      ride({
        mine: true,
        kind: "recurring",
        departsAt: null,
        days: ["sun", "tue"],
        departureTime: "07:30",
        endsOn: "2027-01-19",
      }),
    );
    expect(await screen.findByRole("button", { name: "Renew" })).toBeTruthy();
    expect(screen.getByText("Runs until 19 Jan")).toBeTruthy();
    expect(screen.getByText(/runs through its end date, then disappears/)).toBeTruthy();
  });

  it("says when a ride is gone", async () => {
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
      vi.fn(() => Promise.resolve(Response.json({ error: "not_found" }, { status: 404 }))),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["me"], me);
    queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
    const router = createRouter({
      routeTree,
      context: { queryClient },
      history: createMemoryHistory({ initialEntries: ["/rides/9"] }),
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("This ride isn't available.")).toBeTruthy();
  });
});
