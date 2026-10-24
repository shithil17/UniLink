// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModFaculty } from "../../../shared/schemas/faculty";
import { NOTHING_TO_SAVE } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { FacultySheet } from "./FacultySheet";

vi.mock("@/lib/toast", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

const faculty: ModFaculty = {
  id: 4,
  name: "Dr. Rashid Khan",
  initials: "RkZ",
  designation: "Professor",
  department: "ECE",
  nsuPage: null,
  hidden: false,
};

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(faculty));

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(toast).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderSheet = (target: ModFaculty | "new") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FacultySheet target={target} onClose={() => {}} />
    </QueryClientProvider>,
  );

const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

describe("FacultySheet confirmation", () => {
  it("says there is nothing to save, and opens no dialog, when nothing changed", async () => {
    renderSheet(faculty);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(NOTHING_TO_SAVE));
    expect(screen.queryByRole("heading", { name: "Save faculty changes" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows only the changed field as before and after, and saves only on confirm", async () => {
    renderSheet(faculty);
    fireEvent.change(screen.getByLabelText("Designation"), {
      target: { value: "Associate Professor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sheet = await sheetTitled("Save faculty changes");
    expect(within(sheet).getByText("Professor")).toBeTruthy();
    expect(within(sheet).getByText("Associate Professor")).toBeTruthy();
    // The name was not touched, so it is not listed.
    expect(within(sheet).queryByText("Dr. Rashid Khan")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/faculty/4");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      designation: "Associate Professor",
    });
  });

  it("sends nothing when the edit is cancelled", async () => {
    renderSheet(faculty);
    fireEvent.change(screen.getByLabelText("Designation"), { target: { value: "Lecturer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sheet = await sheetTitled("Save faculty changes");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Save faculty changes" })).toBeNull(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("summarises a hide with the reason and fires only when confirmed", async () => {
    renderSheet(faculty);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "left NSU" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    const sheet = await sheetTitled("Hide faculty");
    expect(within(sheet).getByText("left NSU")).toBeTruthy();
    expect(within(sheet).getByText(/no longer show in the attempt picker/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Hide faculty" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/faculty/4/hide");
  });
});
