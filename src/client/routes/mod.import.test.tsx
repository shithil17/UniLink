// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModCourse, ModCurriculum } from "../../shared/schemas/modCourses";
import { Route } from "./mod.import";

const curriculum: ModCurriculum = {
  id: 1,
  programCode: "42",
  programName: "Computer Science and Engineering",
  name: "BSc in CSE",
  version: "2024",
  effectiveFromYear: 24,
  courseCount: 2,
};

const slot = (id: number, code: string, title: string): ModCourse => ({
  id,
  curriculumId: 1,
  kind: "course",
  code,
  title,
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  hidden: false,
});

const row = (code: string, title: string) => ({
  kind: "course",
  code,
  title,
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
});

const file = (version: string, courses: unknown[]) =>
  new File(
    [
      JSON.stringify({
        program: "42",
        name: "BSc in CSE",
        version,
        effectiveFromYear: 24,
        totalCredits: 130,
        courses,
      }),
    ],
    "cse.json",
    { type: "application/json" },
  );

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url === "/api/mod/curricula") return Response.json([curriculum]);
  if (url === "/api/mod/curricula/1/courses") {
    return Response.json([
      slot(1, "CSE115", "Programming I"),
      slot(2, "CSE225", "Data Structures"),
    ]);
  }
  if (url === "/api/courses/import") {
    return Response.json({ curriculumId: 1, imported: 2, rejected: [] });
  }
  return Response.json({}, { status: 404 });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const importCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/courses/import");

function renderPage() {
  const Page = Route.options.component!;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Page />
    </QueryClientProvider>,
  );
}

const pick = async (f: File) => {
  fireEvent.change(screen.getByLabelText(/Curriculum file/), { target: { files: [f] } });
  await screen.findByText(/cse.json: program 42/);
};

const sheetTitled = async (title: string) =>
  (await screen.findByRole("heading", { name: title })).closest<HTMLElement>('[role="dialog"]')!;

describe("curriculum import confirmation", () => {
  it("shows what a replacement adds, changes and removes, and imports only on confirm", async () => {
    renderPage();
    await pick(file("2024", [row("CSE115", "Programming I"), row("MAT120", "Calculus I")]));
    // Wait for the version's current courses so the counts can be worked out.
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => u === "/api/mod/curricula/1/courses")).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    const sheet = await sheetTitled("Replace curriculum");
    expect(importCalls()).toHaveLength(0);

    const counts = within(sheet).getByText("Added").closest("div")!.parentElement!;
    await waitFor(() => expect(counts.textContent).toBe("1Added0Changed1Removed"));
    expect(within(sheet).getByText(/including changes made in the Courses screen/)).toBeTruthy();

    fireEvent.click(within(sheet).getByRole("button", { name: "Replace courses" }));
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    expect(await screen.findByText(/Imported 2 courses/)).toBeTruthy();
  });

  it("imports nothing when the confirmation is cancelled", async () => {
    renderPage();
    await pick(file("2025", [row("CSE115", "Programming I")]));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    const sheet = await sheetTitled("Import curriculum");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Import curriculum" })).toBeNull(),
    );
    expect(importCalls()).toHaveLength(0);
  });
});
