// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { resetFakeMapParam } from "@/test/fakeMapParam";
import { Map as FakeMap, liveMaps, resetFakeMaps } from "@/test/fakeMapLibre";
import { CONTACT_REQUIRED_MESSAGE } from "../../../shared/contact";
import { POST_RENEW_EXTEND_DAYS } from "../../../shared/posts";
import type { AreaOption } from "../../../shared/schemas/areas";
import type { RideDetail } from "../../../shared/schemas/rides";
import { RideForm } from "./RideForm";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));
// No router here: the open map lives in a variable instead of the URL.
vi.mock("@/lib/map/useMapParam", () => import("@/test/fakeMapParam"));

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  resetFakeMaps();
  resetFakeMapParam();
  // A phone: the trip map sits inside the form, under the destination.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AREAS: AreaOption[] = [
  { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", lat: null, lng: null, children: [] },
  {
    id: 2,
    slug: "mirpur",
    name: "Mirpur",
    lat: null,
    lng: null,
    children: [{ id: 20, slug: "mirpur-mirpur-10", name: "Mirpur 10", lat: null, lng: null }],
  },
];

/** The same areas with points, for the tests where the map opens on an area or fills one in. */
const POINTED_AREAS: AreaOption[] = [
  { ...AREAS[0]!, lat: 23.8151, lng: 90.4253 },
  { ...AREAS[1]!, lat: 23.8223, lng: 90.3654 },
];

// The list the server answers with; a test drops an area from it to play a hide that happened after the form loaded.
let areaList = AREAS;

function setup({ areas = AREAS, ride }: { areas?: AreaOption[]; ride?: RideDetail } = {}) {
  areaList = areas;
  // The area list answers for itself; `fetchMock` sees only the ride requests.
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", (path: string, init?: RequestInit) =>
    path === "/api/areas" ? Promise.resolve(Response.json(areaList)) : fetchMock(path, init),
  );
  const onSaved = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RideForm
        ride={ride}
        contacts={ride ? { phone: "+8801712345678" } : undefined}
        onSaved={onSaved}
        onCancel={() => {}}
      />
    </QueryClientProvider>,
  );
  return { fetchMock, onSaved };
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const post = () => fireEvent.click(screen.getByRole("button", { name: "Post ride" }));

/** Opens the From or To picker, picks the area and waits for the sheet to close. */
async function pickArea(label: "From" | "To", name: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

/** Picks a departure the 15th of next month, so it is always ahead of today, and types the time. */
async function pickDeparture() {
  await pickDay(/^Departs, /);
  await pickTime(/^Departure time, /, "7", "30", "AM");
}

/** Picks a time in a TimeField's sheet: opens it by the field's name, sets the three lists and presses Done. */
async function pickTime(field: RegExp, hour: string, minute: string, period: "AM" | "PM") {
  fireEvent.click(screen.getByRole("button", { name: field }));
  const pick = async (list: string, name: string) =>
    fireEvent.click(
      within(await screen.findByRole("listbox", { name: list })).getByRole("option", { name }),
    );
  await pick("Hour", hour);
  await pick("Minute", minute);
  await pick("AM or PM", period);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("listbox", { name: "Hour" })).toBeNull());
}

/** Opens a date field by its accessible name, steps to next month and picks the 15th. */
async function pickDay(field: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: field }));
  fireEvent.click(await screen.findByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: /^\w+day, 15 \w+ \d{4}$/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

async function fillCommon(contact = true) {
  await pickArea("From", "Bashundhara R/A");
  await pickArea("To", "Mirpur 10, in Mirpur");
  type("Pickup landmark (optional)", "NSU gate");
  type("Destination landmark (optional)", "Mirpur 10");
  type("Seats", "3");
  type("Taka per seat", "100");
  if (contact) type("Phone number", "01712345678");
}

describe("RideForm", () => {
  it("toasts the first message when the form is invalid, marks that field and sends nothing", async () => {
    const { fetchMock } = setup();
    post();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Pick a pickup area");
    expect(screen.getByLabelText("From").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();

    // Fix everything above the seats: the seats are next, and the toast moves down with the form.
    await pickArea("From", "Bashundhara R/A");
    await pickArea("To", "Mirpur 10, in Mirpur");
    post();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenLastCalledWith("Enter how many seats you can offer");
    expect(screen.getByLabelText("Seats").getAttribute("aria-invalid")).toBe("true");
  });

  it("toasts the field that is highest in the form, not the one the schema checks first", async () => {
    setup();
    await fillCommon(false);
    // No departure and no contact: the schema reports the contact first, the form shows the departure first.
    post();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Pick the departure date and time");
    expect(screen.getByLabelText("Departs").getAttribute("aria-invalid")).toBe("true");
  });

  it("toasts a friendly line for the days of a recurring ride and for nested contacts", async () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    await fillCommon(false);
    await pickTime(/^Leaves at, /, "7", "30", "AM");
    post();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Pick at least one day");

    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    post();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenLastCalledWith(CONTACT_REQUIRED_MESSAGE);
    expect(screen.getByLabelText("Phone number").getAttribute("aria-invalid")).toBe("true");
  });

  it("states the safety notice and what happens to a one-off ride", () => {
    setup();
    expect(screen.getByText(/doesn't arrange or guarantee rides/)).toBeTruthy();
    expect(screen.getByText(/disappears from the feed when it departs/)).toBeTruthy();
  });

  it("asks for a departure on a one-off ride and sends nothing", async () => {
    const { fetchMock } = setup();
    await fillCommon();
    post();
    expect(await screen.findByText("Pick the departure date and time")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs both areas, saying so under each, and sends nothing", async () => {
    const { fetchMock } = setup();
    type("Seats", "3");
    type("Taka per seat", "100");
    type("Phone number", "01712345678");
    await pickDeparture();
    post();
    expect(await screen.findByText("Pick a pickup area")).toBeTruthy();
    expect(screen.getByText("Pick a destination area")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    // Picking one clears its message and leaves the other.
    await pickArea("From", "Bashundhara R/A");
    await waitFor(() => expect(screen.queryByText("Pick a pickup area")).toBeNull());
    expect(screen.getByText("Pick a destination area")).toBeTruthy();
  });

  it("marks the area the server refused, once the fresh list shows it is gone", async () => {
    const { fetchMock } = setup();
    await fillCommon();
    await pickDeparture();
    // Mirpur 10 was hidden after the form loaded its list.
    fetchMock.mockImplementation(async () => {
      areaList = [AREAS[0]!, { ...AREAS[1]!, children: [] }];
      return Response.json(
        { error: "invalid_area", message: "Pick a pickup and a destination area from the list." },
        { status: 400 },
      );
    });
    post();
    expect(await screen.findByText("That area isn't available. Pick another.")).toBeTruthy();
    // The server's refusal is a toast too, not only the marks under the fields.
    expect(toast.error).toHaveBeenCalledWith(
      "Pick a pickup and a destination area from the list.",
      undefined,
    );
    expect(screen.getAllByText("That area isn't available. Pick another.")).toHaveLength(1);
  });

  it("asks for at least one contact", async () => {
    const { fetchMock } = setup();
    await fillCommon(false);
    await pickDeparture();
    post();
    expect(await screen.findByText(CONTACT_REQUIRED_MESSAGE)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks a recurring ride for days and a time, and states the 60 day default and renewal", async () => {
    const { fetchMock } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    expect(screen.getByText(/runs for 60 days/)).toBeTruthy();
    expect(screen.getByText(/You can renew it/)).toBeTruthy();
    await fillCommon();
    post();
    expect(await screen.findByText("Pick at least one day")).toBeTruthy();
    // The time button's own placeholder says "Pick a time" too, so look for the error's alert.
    expect(screen.getAllByRole("alert").some((a) => a.textContent === "Pick a time")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a recurring ride with the picked days, without an end date when left empty", async () => {
    const { fetchMock, onSaved } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    await fillCommon();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Sunday" }));
    await pickTime(/^Leaves at, /, "7", "30", "AM");
    post();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/rides");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: "recurring",
      pickupAreaId: 1,
      destinationAreaId: 20,
      pickupLandmark: "NSU gate",
      destinationLandmark: "Mirpur 10",
      days: ["sun", "tue"],
      departureTime: "07:30",
      totalSeats: 3,
      pricePerSeatTaka: 100,
      contacts: { phone: "+8801712345678" },
    });
    expect(body).not.toHaveProperty("endsOn");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("sends the number as a phone and a WhatsApp link, or WhatsApp alone", async () => {
    for (const calls of [true, false]) {
      cleanup();
      const { fetchMock } = setup();
      fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
      await fillCommon();
      await pickDeparture();
      if (!calls) fireEvent.click(screen.getByRole("button", { name: "Calls" }));
      post();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.contacts).toEqual(
        calls
          ? { phone: "+8801712345678", whatsapp: "https://wa.me/8801712345678" }
          : { whatsapp: "https://wa.me/8801712345678" },
      );
    }
  });

  it("shows the picked departure day first and sends it as a Dhaka instant", async () => {
    const { fetchMock } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    await fillCommon();
    await pickDeparture();
    // "Sun, 15 Nov 2026": weekday, day, month as a word, year. Never "11/15/2026".
    const shown = screen.getByRole("button", { name: /^Departs, / }).textContent ?? "";
    expect(shown).toMatch(/^[A-Z][a-z]{2}, 15 [A-Z][a-z]{2} \d{4}$/);
    post();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    // 07:30 in Dhaka (UTC+6) is 01:30 UTC on the 15th.
    expect(new Date(body.departsAt).getUTCDate()).toBe(15);
    expect(new Date(body.departsAt).getUTCHours()).toBe(1);
    expect(new Date(body.departsAt).getUTCMinutes()).toBe(30);
  });

  it("asks for the time when only the departure date is picked, and focuses the date field", async () => {
    setup();
    await fillCommon();
    await pickDay(/^Departs, /);
    post();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Pick the departure date and time"),
    );
    expect(screen.getByRole("button", { name: /^Departs, / }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("sends the picked end date of a recurring ride, and drops it again with Clear", async () => {
    const { fetchMock } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    await fillCommon();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    await pickTime(/^Leaves at, /, "7", "30", "AM");
    await pickDay(/^Runs until \(optional\), /);
    fireEvent.click(screen.getByRole("button", { name: /^Runs until \(optional\), / }));
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /^Runs until \(optional\), / }).textContent).toBe(
      "Pick a date",
    );
    await pickDay(/^Runs until \(optional\), /);
    post();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.endsOn).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("keeps '(optional)' on the end date label of a new recurring ride", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    expect(screen.getByText("Runs until (optional)")).toBeTruthy();
  });

  describe("editing a recurring ride", () => {
    const recurring: RideDetail = {
      id: 7,
      kind: "recurring",
      pickupArea: { id: 1, name: "Bashundhara R/A" },
      destinationArea: { id: 2, name: "Mirpur" },
      pickupLandmark: null,
      destinationLandmark: null,
      pickupPoint: null,
      destinationPoint: null,
      vehicle: "car",
      totalSeats: 4,
      seatsRemaining: 4,
      pricePerSeatTaka: 100,
      notes: null,
      departsAt: null,
      days: ["tue"],
      departureTime: "07:30",
      endsOn: "2026-12-15",
      state: "open",
      status: "published",
      expiresAt: Date.UTC(2026, 11, 15),
      createdAt: Date.UTC(2026, 10, 1),
      mine: true,
    };

    function renderEdit() {
      vi.stubGlobal("fetch", (path: string) =>
        path === "/api/areas" ? Promise.resolve(Response.json(AREAS)) : Promise.reject(new Error()),
      );
      render(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <RideForm
            ride={recurring}
            contacts={{ phone: "01712345678" }}
            onSaved={() => {}}
            onCancel={() => {}}
          />
        </QueryClientProvider>,
      );
    }

    it("does not offer to clear the end date, and says renewing is how to add days", async () => {
      renderEdit();
      // The hint line is there for both modes; on edit it no longer promises a default for an empty date.
      expect(screen.queryByText(/Leave it empty/)).toBeNull();
      expect(
        screen.getByText(new RegExp(`renew the ride to add ${POST_RENEW_EXTEND_DAYS} days`)),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /^Runs until, / }));
      await screen.findByRole("button", { name: "Next month" });
      expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    });

    it("labels the end date 'Runs until' on edit, without '(optional)'", () => {
      renderEdit();
      expect(screen.getByText("Runs until")).toBeTruthy();
      expect(screen.queryByText(/Runs until \(optional\)/)).toBeNull();
      expect(screen.queryByRole("button", { name: /^Runs until \(optional\), / })).toBeNull();
    });
  });
});

describe("pins", () => {
  /** The interactive map, once the full-screen picker has built it and its style is loaded. */
  async function pickerMap() {
    await waitFor(() => expect(liveMaps().some((m) => m.options.interactive === true)).toBe(true));
    await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());
    return liveMaps().find((m) => m.options.interactive === true)!;
  }
  const openPicker = (end: "pickup" | "destination") =>
    fireEvent.click(
      screen.getByRole("button", { name: `Pin the exact spot (optional) for the ${end}` }),
    );
  /** Plays the student moving the map under the pin. */
  const moveTo = (map: FakeMap, lat: number, lng: number) => act(() => map.moveTo({ lat, lng }));
  const useThisSpot = () => fireEvent.click(screen.getByRole("button", { name: "Use this spot" }));
  const sentBody = (call: unknown[] | undefined) =>
    JSON.parse((call as [string, RequestInit])[1].body as string);

  const recurring = (over: Partial<RideDetail> = {}): RideDetail => ({
    id: 7,
    kind: "recurring",
    pickupArea: { id: 1, name: "Bashundhara R/A" },
    destinationArea: { id: 2, name: "Mirpur" },
    pickupLandmark: null,
    destinationLandmark: null,
    pickupPoint: { lat: 23.8151, lng: 90.4253 },
    destinationPoint: { lat: 23.8223, lng: 90.3654 },
    vehicle: "car",
    totalSeats: 4,
    seatsRemaining: 4,
    pricePerSeatTaka: 100,
    notes: null,
    departsAt: null,
    days: ["tue"],
    departureTime: "07:30",
    endsOn: "2026-12-15",
    state: "open",
    status: "published",
    expiresAt: Date.UTC(2026, 11, 15),
    createdAt: Date.UTC(2026, 10, 1),
    mine: true,
    ...over,
  });

  const STADIUM = { name: "Mirpur Stadium", detail: "Mirpur, Dhaka", lat: 23.8069, lng: 90.3687 };

  /** Types into the picker's search field and picks the stadium result. */
  async function searchStadium() {
    const field = await screen.findByRole("combobox", { name: "Search for a place or area" });
    fireEvent.change(field, { target: { value: "stadium" } });
    fireEvent.click(await screen.findByRole("option", { name: /Mirpur Stadium/ }));
  }

  it("moves the map to a searched place and offers its name as an empty landmark only once the spot is confirmed", async () => {
    const { fetchMock } = setup();
    fetchMock.mockImplementation(async () => Response.json({ places: [STADIUM] }));
    openPicker("pickup");
    const map = await pickerMap();
    await searchStadium();

    expect(map.called("flyTo").at(-1)?.args[0]).toMatchObject({ center: [90.3687, 23.8069] });
    // Picking is not confirming: nothing is filled or saved yet.
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Pinned")).toBeNull();
    useThisSpot();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Pin the pickup" })).toBeNull(),
    );
    expect(toast.success).toHaveBeenCalledWith("Landmark set to Mirpur Stadium");
    expect(screen.getByLabelText("Pickup landmark (optional)")).toHaveProperty(
      "value",
      "Mirpur Stadium",
    );
    expect(screen.getByLabelText("Destination landmark (optional)")).toHaveProperty("value", "");
  });

  it("leaves the landmark empty when the picker is closed after picking a place", async () => {
    const { fetchMock } = setup();
    fetchMock.mockImplementation(async () => Response.json({ places: [STADIUM] }));
    openPicker("pickup");
    await pickerMap();
    await searchStadium();
    fireEvent.click(screen.getByRole("button", { name: "Close the map" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Pin the pickup" })).toBeNull(),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pickup landmark (optional)")).toHaveProperty("value", "");

    // A reopened picker starts with no remembered place: confirming a moved map offers nothing.
    openPicker("pickup");
    const map = await pickerMap();
    moveTo(map, 23.79, 90.41);
    useThisSpot();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Pin the pickup" })).toBeNull(),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pickup landmark (optional)")).toHaveProperty("value", "");
  });

  it("never overwrites a landmark the student typed", async () => {
    const { fetchMock } = setup();
    fetchMock.mockImplementation(async () => Response.json({ places: [STADIUM] }));
    type("Pickup landmark (optional)", "NSU gate");
    openPicker("pickup");
    const map = await pickerMap();
    await searchStadium();

    expect(map.called("flyTo")).toHaveLength(1);
    useThisSpot();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Pin the pickup" })).toBeNull(),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Pickup landmark (optional)")).toHaveProperty("value", "NSU gate");
  });

  it("sends the spot the student placed, rounded, and no pin for the other end", async () => {
    const { fetchMock } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    await fillCommon();
    await pickDeparture();

    openPicker("pickup");
    expect(await screen.findByRole("dialog", { name: "Pin the pickup" })).toBeTruthy();
    const map = await pickerMap();
    moveTo(map, 23.8123456, 90.4012345);
    useThisSpot();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Pinned")).toBeTruthy();

    post();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = sentBody(fetchMock.mock.calls[0]);
    expect(body.pickupPoint).toEqual({ lat: 23.81235, lng: 90.40123 });
    expect(body).not.toHaveProperty("destinationPoint");
  });

  it("does not save the area's centre when the map was never moved", async () => {
    setup({ areas: POINTED_AREAS });
    await pickArea("From", "Bashundhara R/A");
    openPicker("pickup");
    const map = await pickerMap();
    // It opened on the area's point at street zoom, and the spot is not confirmable yet.
    expect(map.options.bounds).toEqual([
      [90.4253, 23.8151],
      [90.4253, 23.8151],
    ]);
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(
      "Move the map to place the pin",
    );
    expect(
      (screen.getByRole("button", { name: "Use this spot" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Remove pin" })).toBeNull();

    // Enter says why instead of storing the centre.
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(toast.error).toHaveBeenCalledWith("Move the map to place the pin first.");
    expect(screen.getByRole("dialog", { name: "Pin the pickup" })).toBeTruthy();

    // Moved: now it can be kept.
    moveTo(map, 23.8165, 90.4262);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Use this spot" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("confirms with Enter", async () => {
    const { fetchMock } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    await fillCommon();
    await pickDeparture();
    openPicker("destination");
    const map = await pickerMap();
    moveTo(map, 23.79, 90.41);
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    post();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock.mock.calls[0]).destinationPoint).toEqual({ lat: 23.79, lng: 90.41 });
  });

  it("fills the nearest area into an empty area field, and never replaces a picked one", async () => {
    setup({ areas: POINTED_AREAS });
    // Both ends start empty: a pin near Mirpur names the pickup area.
    openPicker("pickup");
    moveTo(await pickerMap(), 23.8221, 90.366);
    useThisSpot();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText("From").textContent).toBe("Mirpur"));

    // The destination already has Bashundhara, so a pin next to Mirpur leaves it alone.
    await pickArea("To", "Bashundhara R/A");
    openPicker("destination");
    moveTo(await pickerMap(), 23.8222, 90.3655);
    useThisSpot();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getAllByText("Pinned")).toHaveLength(2);
    expect(screen.getByLabelText("To").textContent).toBe("Bashundhara R/A");
  });

  it("removes a pin from the picker, and an edit sends null for it", async () => {
    const { fetchMock } = setup({ areas: POINTED_AREAS, ride: recurring() });
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    // Both ends are pinned: the rows say so and the picker opens on the pin with Remove.
    expect(screen.getAllByText("Pinned")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Change the pickup pin" }));
    await pickerMap();
    fireEvent.click(screen.getByRole("button", { name: "Remove pin" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getAllByText("Pinned")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Pin the exact spot (optional) for the pickup" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ pickupPoint: null });
  });

  it("leaves pins out of an edit that did not touch them", async () => {
    const { fetchMock } = setup({ areas: POINTED_AREAS, ride: recurring() });
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    type("Taka per seat", "120");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ pricePerSeatTaka: 120 });
  });

  it("keeps one trip preview, always rendered, and no second map while a picker is open", async () => {
    setup();
    // The city view before any area is picked.
    expect(screen.getByRole("button", { name: "Open the map of your ride" })).toBeTruthy();
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    expect(liveMaps()[0]!.options.interactive).toBe(false);
    openPicker("pickup");
    await pickerMap();
    expect(liveMaps()).toHaveLength(1);
  });

  it("opens the trip map from the preview with the two ends and no Open in Maps", async () => {
    setup({ areas: POINTED_AREAS });
    await pickArea("From", "Bashundhara R/A");
    fireEvent.click(screen.getByRole("button", { name: "Open the map of your ride" }));
    const dialog = await screen.findByRole("dialog", { name: "Map of your ride" });
    expect(within(dialog).getByText("Bashundhara R/A")).toBeTruthy();
    // The destination is not picked yet, and the card says so without a gap.
    expect(within(dialog).getByText("Not picked yet")).toBeTruthy();
    expect(within(dialog).queryByRole("link", { name: /Open in Maps/ })).toBeNull();
    await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());
    expect(screen.getByText("Around Bashundhara R/A")).toBeTruthy();
  });
});
