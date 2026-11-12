// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideSummary } from "../../shared/schemas/rides";
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
  id: 5,
  kind: "one_off",
  pickup: "NSU gate",
  destination: "Mirpur 10",
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const contacts = {
  phone: "+8801712345678",
  whatsapp: "https://wa.me/8801712345678",
  messenger: "https://m.me/dev.cse",
};

function renderDetail(
  detail: RideSummary,
  contactResponse: () => Response = () => Response.json({ contacts }),
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
  const fetchMock = vi.fn((path: string) =>
    path === `/api/rides/${detail.id}/contact`
      ? Promise.resolve(contactResponse())
      : Promise.reject(new Error("No network in this test")),
  );
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
  return fetchMock;
}

describe("Ride detail", () => {
  it("shows the ride and keeps the contact hidden until it is asked for", async () => {
    const fetchMock = renderDetail(ride());
    expect(await screen.findByRole("heading", { name: "NSU gate to Mirpur 10" })).toBeTruthy();
    expect(screen.getByText("Fri 20 Nov, 7:30 am")).toBeTruthy();
    expect(screen.getByText("3 of 4 seats left")).toBeTruthy();
    expect(screen.getByText("150 taka a seat")).toBeTruthy();
    expect(screen.getByText("Wait at gate 2")).toBeTruthy();
    expect(screen.getByText(/doesn't arrange or guarantee rides/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report this ride" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\+8801|wa\.me|m\.me/);
    expect(document.querySelector("a[href^='tel:']")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(screen.getByRole("button", { name: "A seat was taken" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark as full" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete this ride" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show contact" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Report this ride" })).toBeNull();
    // A one-off cannot be renewed.
    expect(screen.queryByRole("button", { name: "Renew" })).toBeNull();
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
