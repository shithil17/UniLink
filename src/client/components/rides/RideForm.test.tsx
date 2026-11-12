// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { CONTACT_REQUIRED_MESSAGE } from "../../../shared/contact";
import { POST_RENEW_EXTEND_DAYS } from "../../../shared/posts";
import type { RideSummary } from "../../../shared/schemas/rides";
import { RideForm } from "./RideForm";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AREAS = [
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

// The list the server answers with; a test drops an area from it to play a hide that happened after the form loaded.
let areaList = AREAS;

function setup() {
  areaList = AREAS;
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
      <RideForm onSaved={onSaved} onCancel={() => {}} />
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
    const recurring: RideSummary = {
      id: 7,
      kind: "recurring",
      pickupArea: { id: 1, name: "Bashundhara R/A" },
      destinationArea: { id: 2, name: "Mirpur" },
      pickupLandmark: null,
      destinationLandmark: null,
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
