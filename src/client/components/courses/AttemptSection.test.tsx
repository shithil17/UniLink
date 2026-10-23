// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ATTEMPT_GRADES } from "../../../shared/grading";
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
  faculty: { name: "Amy Ay", initials: "AA" },
  createdAt: 1,
  ...over,
});

function stubApi(attempts: Attempt[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      Response.json(
        path === "/api/faculty"
          ? [{ id: 7, name: "Amy Ay", initials: "AA", designation: "Lecturer", department: "ECE" }]
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
    expect(await screen.findByText("Amy Ay (AA)")).toBeTruthy();
    expect(screen.getByText("Retake allowed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add attempt" }));
    expect(await screen.findByLabelText("Faculty (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Term").textContent).toContain("Pick a term");
  });

  it("still names a faculty member who is no longer in the picker list", async () => {
    stubApi([attempt({ facultyId: 99, faculty: { name: "Gone Person", initials: null } })]);
    renderWith(<AttemptSection choices={choices} onSaved={() => {}} />);
    expect(await screen.findByText("Gone Person")).toBeTruthy();
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

describe("AttemptForm grade grid", () => {
  beforeEach(() => stubApi([]));

  it("lists every grade as a radio in a labelled group", () => {
    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Grade" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(ATTEMPT_GRADES.length);
    ATTEMPT_GRADES.forEach((g, i) => {
      expect(radios[i].getAttribute("aria-label")?.startsWith(g)).toBe(true);
      expect(group.contains(radios[i])).toBe(true);
    });
    expect(screen.getByRole("radio", { name: "A-, 3.7 points" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "WV, waived" })).toBeTruthy();
  });

  it("submits the picked grade in the same payload as before", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(init.body as string));
          return Response.json(attempt({ grade: "B+" }));
        }
        return Response.json(path === "/api/faculty" ? [] : []);
      }),
    );
    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    const pick = screen.getByRole("radio", { name: "B+, 3.3 points" });
    fireEvent.click(pick);
    expect(pick.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ courseCode: "CSE115", grade: "B+", term: null, facultyId: null });
  });

  it("shows the inline error when no grade is picked", async () => {
    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Save grade" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Grade" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("moves the choice with the arrow keys", async () => {
    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    const a = screen.getByRole("radio", { name: "A, 4.0 points" });
    fireEvent.click(a);
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: "A-, 3.7 points" }).getAttribute("aria-checked"),
      ).toBe("true"),
    );
  });

  it("explains a waived grade once picked", () => {
    renderWith(<AttemptForm choices={choices} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "WV, waived" }));
    expect(screen.getByText(/counts toward your credits, not your CGPA/)).toBeTruthy();
  });
});
