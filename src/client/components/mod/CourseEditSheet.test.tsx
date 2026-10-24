// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModCourse } from "../../../shared/schemas/modCourses";
import { NOTHING_TO_SAVE } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { CourseEditSheet } from "./CourseEditSheet";

vi.mock("@/lib/toast", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

const base: ModCourse = {
  id: 7,
  curriculumId: 1,
  kind: "course",
  code: "CSE215",
  title: "Programming Language II",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 3,
  alternatives: [],
  prereq: { course: "CSE115" },
  hidden: false,
};
const prior: ModCourse = { ...base, id: 6, code: "CSE115", title: "Programming I", prereq: null };

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(base));

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(toast).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderSheet = (target: ModCourse | "new") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CourseEditSheet
        target={target}
        curriculumId={1}
        courses={[prior, base]}
        defaultCategory="Core"
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );

const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

describe("CourseEditSheet confirmation", () => {
  it("says there is nothing to save, and opens no dialog, when nothing changed", async () => {
    renderSheet(base);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(NOTHING_TO_SAVE));
    expect(screen.queryByRole("heading", { name: "Save course changes" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists only the changed fields as before and after, and saves only on confirm", async () => {
    renderSheet(base);
    fireEvent.change(screen.getByLabelText("Credits"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sheet = await sheetTitled("Save course changes");
    expect(within(sheet).getByText("Credits")).toBeTruthy();
    expect(within(sheet).getByText("3")).toBeTruthy();
    expect(within(sheet).getByText("4")).toBeTruthy();
    expect(within(sheet).queryByText("Title")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/courses/7");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ credits: 4 });
  });

  it("summarises a new course before adding it", async () => {
    renderSheet("new");
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "cse311" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Databases" } });
    fireEvent.change(screen.getByLabelText("Credits"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add course" }));
    const sheet = await sheetTitled("Add course");
    expect(within(sheet).getByText("CSE311")).toBeTruthy();
    expect(within(sheet).getByText("Databases")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Add course" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mod/curricula/1/courses");
  });

  it("asks to confirm a hide, with the reason, and sends nothing on Cancel", async () => {
    renderSheet(base);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "dropped from 2025" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    const sheet = await sheetTitled("Hide course");
    expect(within(sheet).getByText("dropped from 2025")).toBeTruthy();
    expect(within(sheet).getByText(/Students stop seeing this course/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Hide course" })).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
