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

function setup() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
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

function fillCommon(contact = true) {
  type("Pickup", "NSU gate");
  type("Destination", "Mirpur 10");
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
    fillCommon();
    post();
    expect(await screen.findByText("Pick the departure date and time")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for at least one contact", async () => {
    const { fetchMock } = setup();
    fillCommon(false);
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
    fillCommon();
    post();
    expect(await screen.findByText("Pick at least one day")).toBeTruthy();
    expect(screen.getByText("Use a 24-hour time like 07:30")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a recurring ride with the picked days, without an end date when left empty", async () => {
    const { fetchMock, onSaved } = setup();
    fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
    fireEvent.click(screen.getByRole("radio", { name: "Recurring" }));
    fillCommon();
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
