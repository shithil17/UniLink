// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CONTACT_REQUIRED_MESSAGE } from "../../../shared/contact";
import { RideForm } from "./RideForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AREAS = [
  { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", children: [] },
  {
    id: 2,
    slug: "mirpur",
    name: "Mirpur",
    children: [{ id: 20, slug: "mirpur-mirpur-10", name: "Mirpur 10" }],
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

async function fillCommon(contact = true) {
  await pickArea("From", "Bashundhara R/A");
  await pickArea("To", "Mirpur 10, in Mirpur");
  type("Pickup landmark (optional)", "NSU gate");
  type("Destination landmark (optional)", "Mirpur 10");
  type("Seats", "3");
  type("Taka per seat", "100");
  if (contact) type("Phone", "+8801712345678");
}

describe("RideForm", () => {
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
    type("Phone", "+8801712345678");
    type("Departs", "2099-11-20T07:30");
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
    type("Departs", "2099-11-20T07:30");
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
    expect(screen.getAllByText("That area isn't available. Pick another.")).toHaveLength(1);
  });

  it("asks for at least one contact", async () => {
    const { fetchMock } = setup();
    await fillCommon(false);
    type("Departs", "2099-11-20T07:30");
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
    expect(screen.getByText("Use a 24-hour time like 07:30")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a recurring ride with the picked days, without an end date when left empty", async () => {
    const { fetchMock, onSaved } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    await fillCommon();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Sunday" }));
    type("Leaves at", "07:30");
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
});
