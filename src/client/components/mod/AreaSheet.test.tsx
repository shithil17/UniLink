// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModArea } from "../../../shared/schemas/areas";
import { NOTHING_TO_SAVE } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { AreaSheet, type AreaSheetTarget } from "./AreaSheet";

vi.mock("@/lib/toast", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

const mirpur: ModArea = {
  id: 7,
  slug: "mirpur",
  name: "Mirpur",
  parentId: null,
  lat: null,
  lng: null,
  hidden: false,
  hiddenReason: null,
};
const pallabi: ModArea = { ...mirpur, id: 8, slug: "mirpur-pallabi", name: "Pallabi", parentId: 7 };
const ghost: ModArea = {
  ...mirpur,
  id: 9,
  slug: "ghost",
  name: "Ghost Town",
  hidden: true,
  hiddenReason: "Not a real place",
};

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(mirpur));

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderSheet = (initial: AreaSheetTarget, onTarget = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AreaSheet target={initial} parents={[mirpur, ghost]} onTarget={onTarget} />
    </QueryClientProvider>,
  );

const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

describe("AreaSheet", () => {
  it("says there is nothing to save when the name is unchanged, and sends nothing", async () => {
    renderSheet({ mode: "edit", area: mirpur, parent: null });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(NOTHING_TO_SAVE));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a rename as before and after and sends it only when confirmed", async () => {
    renderSheet({ mode: "edit", area: mirpur, parent: null });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mirpur DOHS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sheet = await sheetTitled("Rename area");
    expect(within(sheet).getByText("Mirpur DOHS")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/mod/areas/7");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
      name: "Mirpur DOHS",
    });
  });

  it("asks for a reason to hide, summarises it and fires only when confirmed", async () => {
    renderSheet({ mode: "edit", area: pallabi, parent: mirpur });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(await screen.findByText(/Give a reason of at least/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Not a pickup point" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    const sheet = await sheetTitled("Hide area");
    expect(within(sheet).getByText("Not a pickup point")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Hide area" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/mod/areas/8/hide");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
      reason: "Not a pickup point",
    });
  });

  it("says why a hidden area is hidden and shows it again with a reason", async () => {
    renderSheet({ mode: "edit", area: ghost, parent: null });
    expect(screen.getByText(/Reason: Not a real place/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "It is real" } });
    fireEvent.click(screen.getByRole("button", { name: "Show again" }));
    const sheet = await sheetTitled("Show area again");
    fireEvent.click(within(sheet).getByRole("button", { name: "Show again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/mod/areas/9/unhide");
  });

  it("offers a sub-area only on a top-level area", () => {
    const onTarget = vi.fn();
    renderSheet({ mode: "edit", area: mirpur, parent: null }, onTarget);
    fireEvent.click(screen.getByRole("button", { name: "Add a sub-area" }));
    expect(onTarget).toHaveBeenCalledWith({ mode: "add", parent: mirpur });
    cleanup();
    renderSheet({ mode: "edit", area: pallabi, parent: mirpur });
    expect(screen.queryByRole("button", { name: "Add a sub-area" })).toBeNull();
  });

  it("adds a sub-area under the chosen parent after a confirmation", async () => {
    renderSheet({ mode: "add", parent: mirpur });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mirpur 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add area" }));
    const sheet = await sheetTitled("Add area");
    expect(within(sheet).getByText(/sub-area of Mirpur/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Add area" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/mod/areas");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
      name: "Mirpur 10",
      parentId: 7,
    });
  });

  it("asks for a name before adding", async () => {
    renderSheet({ mode: "add", parent: null });
    fireEvent.click(screen.getByRole("button", { name: "Add area" }));
    expect(await screen.findByText("Enter a name")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("Enter a name");
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toasts a blank rename and marks the field", async () => {
    renderSheet({ mode: "edit", area: mirpur, parent: null });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toasts a taken name from the server and keeps the confirm sheet open", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "name_taken", message: "That area name is taken." }, { status: 409 }),
    );
    renderSheet({ mode: "edit", area: mirpur, parent: null });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pallabi" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sheet = await sheetTitled("Rename area");
    fireEvent.click(within(sheet).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That area name is taken."));
  });
});
