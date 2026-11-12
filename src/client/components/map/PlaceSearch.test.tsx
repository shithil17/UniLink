// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { liveMaps, resetFakeMaps, type Map as FakeMap } from "@/test/fakeMapLibre";
import type { AreaOption } from "../../../shared/schemas/areas";
import { MAP_STREET_ZOOM } from "../../../shared/geo";
import { PlaceSearch, PLACE_SEARCH_UNAVAILABLE } from "./PlaceSearch";
import { PinPicker } from "./PinPicker";

vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const AREAS: AreaOption[] = [
  {
    id: 1,
    slug: "bashundhara-r-a",
    name: "Bashundhara R/A",
    lat: 23.8151,
    lng: 90.4253,
    children: [],
  },
  {
    id: 2,
    slug: "mirpur",
    name: "Mirpur",
    lat: 23.8223,
    lng: 90.3654,
    children: [{ id: 20, slug: "mirpur-10", name: "Mirpur 10", lat: null, lng: null }],
  },
  { id: 3, slug: "outside-dhaka", name: "Outside Dhaka", lat: null, lng: null, children: [] },
];

const MIRPUR_STADIUM = {
  name: "Mirpur Stadium",
  detail: "Mirpur, Dhaka",
  lat: 23.8069,
  lng: 90.3687,
};

let fetchMock: ReturnType<typeof vi.fn<(path: string, init?: RequestInit) => Promise<Response>>>;
const placeRequests = () =>
  fetchMock.mock.calls.filter(([path]) => String(path).startsWith("/api/places/search"));

beforeEach(() => {
  resetFakeMaps();
  vi.mocked(toast.error).mockClear();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  fetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ places: [MIRPUR_STADIUM] }),
  );
  vi.stubGlobal("fetch", (path: string, init?: RequestInit) =>
    path === "/api/areas" ? Promise.resolve(Response.json(AREAS)) : fetchMock(path, init),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSearch(onPlace = vi.fn(), onClose = vi.fn(), onConfirm = vi.fn()) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PinPicker
        open
        onClose={onClose}
        label="Pin the pickup"
        point={null}
        fallback={null}
        onConfirm={onConfirm}
        search={(controls) => <PlaceSearch controls={controls} onPlace={onPlace} />}
      />
    </QueryClientProvider>,
  );
  return { onPlace, onClose, onConfirm };
}

async function readyMap(): Promise<FakeMap> {
  await waitFor(() => expect(liveMaps()).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());
  return liveMaps()[0]!;
}

const field = () => screen.getByRole("combobox", { name: "Search for a place or area" });
const typeInto = (text: string) => fireEvent.change(field(), { target: { value: text } });

describe("PlaceSearch", () => {
  it("shows our own areas first with no request, and none without a point", async () => {
    renderSearch();
    await readyMap();
    // Wait for the area list.
    typeInto("mir");
    const list = await screen.findByRole("listbox");
    expect(
      within(list)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["MirpurArea", "Mirpur 10in Mirpur"]);
    expect(placeRequests()).toHaveLength(0);
    // "Outside Dhaka" has no point, so there is nowhere to fly to.
    typeInto("outside");
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
  });

  it("asks for places only after the typing pause and the minimum length, then lists them under the areas", async () => {
    renderSearch();
    await readyMap();
    typeInto("mi");
    await new Promise((r) => setTimeout(r, 450));
    expect(placeRequests()).toHaveLength(0);

    typeInto("mirp");
    expect(placeRequests()).toHaveLength(0);
    const stadium = await screen.findByRole("option", { name: /Mirpur Stadium/ });
    expect(placeRequests()).toHaveLength(1);
    expect(placeRequests()[0]![0]).toBe("/api/places/search?q=mirp");
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["MirpurArea", "Mirpur 10in Mirpur", "Mirpur StadiumMirpur, Dhaka"]);
    expect(stadium).toBeTruthy();
  });

  it("flies to a picked place at street zoom, offers it as the landmark and leaves the pin to the student", async () => {
    const { onPlace, onConfirm } = renderSearch();
    const map = await readyMap();
    typeInto("mirp");
    fireEvent.click(await screen.findByRole("option", { name: /Mirpur Stadium/ }));
    expect(map.called("flyTo").at(-1)?.args[0]).toMatchObject({
      center: [MIRPUR_STADIUM.lng, MIRPUR_STADIUM.lat],
      zoom: MAP_STREET_ZOOM,
    });
    expect(onPlace).toHaveBeenCalledWith("Mirpur Stadium");
    expect(screen.queryByRole("listbox")).toBeNull();
    // Flying there is not placing: the student confirms the spot themselves.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(field()).toHaveProperty("value", "Mirpur Stadium");
  });

  it("flies to a picked area without offering a landmark", async () => {
    const { onPlace } = renderSearch();
    const map = await readyMap();
    typeInto("bash");
    fireEvent.click(await screen.findByRole("option", { name: /Bashundhara R\/A/ }));
    expect(map.called("flyTo").at(-1)?.args[0]).toMatchObject({ center: [90.4253, 23.8151] });
    expect(onPlace).not.toHaveBeenCalled();
    // Picking never starts another search.
    await new Promise((r) => setTimeout(r, 450));
    expect(placeRequests()).toHaveLength(0);
  });

  it("answers a failed place search with the areas alone and one toast per run of failures", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ error: "search_unavailable" }, { status: 502 }),
    );
    renderSearch();
    await readyMap();
    typeInto("mirp");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(PLACE_SEARCH_UNAVAILABLE));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "MirpurArea",
      "Mirpur 10in Mirpur",
    ]);

    // More typing while it is down: asked again, but no second toast.
    typeInto("mirpu");
    await waitFor(() => expect(placeRequests()).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 50));
    expect(toast.error).toHaveBeenCalledTimes(1);

    // A search that works re-arms the toast.
    fetchMock.mockImplementation(async () => Response.json({ places: [MIRPUR_STADIUM] }));
    typeInto("mirpur");
    await screen.findByRole("option", { name: /Mirpur Stadium/ });
    fetchMock.mockImplementation(async () => Response.json({}, { status: 502 }));
    typeInto("mirpur s");
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
  });

  it("moves through results with the arrow keys, picks with Enter and closes the list with Escape before the map", async () => {
    const { onPlace, onClose, onConfirm } = renderSearch();
    const map = await readyMap();
    typeInto("mirp");
    await screen.findByRole("option", { name: /Mirpur Stadium/ });
    expect(field().getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    const active = field().getAttribute("aria-activedescendant");
    expect(document.getElementById(active!)?.textContent).toContain("Mirpur Stadium");

    // Escape closes the list first; the map stays.
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field().getAttribute("aria-expanded")).toBe("false");
    expect(onClose).not.toHaveBeenCalled();

    // Reopen and pick with Enter.
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onPlace).toHaveBeenCalledWith("Mirpur Stadium");
    expect(map.called("flyTo")).toHaveLength(1);
    // Enter inside the field picks a row; it never confirms the pin.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // With no list open, Escape is the map's again.
    fireEvent.keyDown(field(), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
