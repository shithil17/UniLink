// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Attempt } from "../../../shared/schemas/attempts";
import { AttemptForm } from "./AttemptForm";
import { AttemptSection } from "./AttemptSection";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const attempt = (over: Partial<Attempt>): Attempt => ({
  id: 1,
  courseCode: "CSE115",
  grade: "C",
  term: { year: 2025, season: "fall" },
  facultyId: 7,
  createdAt: 1,
  ...over,
});

function stubApi(attempts: Attempt[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      Response.json(
        path === "/api/faculty"
          ? [{ id: 7, name: "Amy Ay", initials: "AA", designation: "Lecturer" }]
          : attempts,
      ),
    ),
  );
}

function renderWith(ui: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );
}

const choices = [{ code: "CSE115", title: "Programming Language I" }];

describe("AttemptSection", () => {
  beforeEach(() => stubApi([]));

  it("offers the quick form while the course has no attempt", async () => {
    renderWith(<AttemptSection choices={choices} onSaved={() => {}} />);
    expect(await screen.findByRole("button", { name: "Save grade" })).toBeTruthy();
    expect(screen.queryByText("Your attempts")).toBeNull();
  });

  it("lists the history with term and faculty, and allows a retake below B+", async () => {
    stubApi([attempt({})]);
    renderWith(<AttemptSection choices={choices} onSaved={() => {}} />);
    expect(await screen.findByText("Your attempts")).toBeTruthy();
    expect(screen.getByText("Fall 2025")).toBeTruthy();
    expect(await screen.findByText("Amy Ay")).toBeTruthy();
    expect(screen.getByText("Retake allowed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add attempt" }));
    expect(await screen.findByLabelText("Faculty (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Term").textContent).toContain("Pick a term");
  });

  it("hides Add attempt and says why once the best grade is B+ or above", async () => {
    stubApi([attempt({ grade: "B+" })]);
    renderWith(<AttemptSection choices={choices} onSaved={() => {}} />);
    expect(await screen.findByText("Retake not allowed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add attempt" })).toBeNull();
    expect(screen.getByText(/best grade for CSE115 is B\+/)).toBeTruthy();
  });

  it("asks before deleting an attempt", async () => {
    stubApi([attempt({})]);
    renderWith(<AttemptSection choices={choices} onSaved={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Delete attempt: C/ }));
    expect(screen.getByText(/Delete this attempt\?/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeTruthy();
  });
});

describe("AttemptForm modes", () => {
  beforeEach(() => stubApi([]));

  it("full form requires a term, the quick form does not", async () => {
    const full = renderWith(<AttemptForm mode="full" choices={choices} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Save attempt" }));
    expect(await screen.findByText("Pick the term you took it in.")).toBeTruthy();
    full.unmount();

    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));
    expect(await screen.findByText(/Invalid|Required|expected/i)).toBeTruthy();
    expect(screen.queryByText("Pick the term you took it in.")).toBeNull();
  });
});
