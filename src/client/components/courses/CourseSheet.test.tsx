// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import { CourseSheet } from "./CourseSheet";

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json([])),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const slot: CourseMap["categories"][number]["slots"][number] = {
  kind: "course",
  code: "CSE225",
  title: "Data Structures",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 3,
  alternatives: [{ code: "CSE226", title: "Data Structures II" }],
  prereq: { all: [{ course: "CSE115" }, { any: [{ course: "MAT120" }, { credits: 30 }] }] },
  status: "locked",
  filledBy: null,
  chosenCode: null,
  waived: false,
  studentCourse: null,
};

function renderSheet(target: Parameters<typeof CourseSheet>[0]["target"]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CourseSheet target={target} categories={["Core"]} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe("CourseSheet", () => {
  it("shows a slot's alternatives, readable prerequisites and the attempt form", async () => {
    renderSheet({ type: "slot", slot });
    expect(screen.getByText("CSE115 and (MAT120 or 30 credits completed)")).toBeTruthy();
    expect(screen.getByText("CSE226 Data Structures II")).toBeTruthy();
    expect(await screen.findByText("You haven't met the prerequisites yet.")).toBeTruthy();
    expect(await screen.findByLabelText("Grade")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record a grade" })).toBeTruthy();
  });

  it("names every code in the header until one is taken, then the course taken", () => {
    const { unmount } = renderSheet({ type: "slot", slot });
    expect(
      screen.getByRole("heading", { name: "CSE225/CSE226 Data Structures / Data Structures II" }),
    ).toBeTruthy();
    expect(screen.getByText("Or take instead")).toBeTruthy();
    unmount();

    renderSheet({ type: "slot", slot: { ...slot, chosenCode: "CSE226", filledBy: "CSE226" } });
    expect(screen.getByRole("heading", { name: "CSE226 Data Structures II" })).toBeTruthy();
    expect(screen.getByText("Other choices for this slot")).toBeTruthy();
    expect(screen.getByText("CSE225 Data Structures")).toBeTruthy();
    expect(screen.queryByText("Or take instead")).toBeNull();
  });

  it("opens the add form with the code editable", () => {
    renderSheet({ type: "add", category: "Core" });
    expect(screen.getByLabelText("Course code").hasAttribute("readonly")).toBe(false);
    expect(screen.getByRole("button", { name: "Add course" })).toBeTruthy();
  });

  it("makes the code read-only when editing a student course", async () => {
    renderSheet({
      type: "extra",
      course: {
        id: 1,
        code: "BUS101",
        title: "Intro",
        credits: 3,
        category: "Core",
        excluded: true,
        createdAt: 0,
        done: false,
        waived: false,
      },
    });
    expect(screen.getByText("Excluded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit course" }));
    expect((await screen.findByLabelText("Course code")).hasAttribute("readonly")).toBe(true);
  });

  it("disables the grade grid and the primary, and says why, while prerequisites are unmet", async () => {
    renderSheet({ type: "slot", slot });
    const group = await screen.findByRole("radiogroup", { name: "Grade" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) expect(radio.getAttribute("aria-disabled")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Record a grade" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText("You haven't met the prerequisites yet.")).toBeTruthy();
  });

  it("enables the grade grid and the primary once prerequisites are met", async () => {
    renderSheet({ type: "slot", slot: { ...slot, status: "available" } });
    const group = await screen.findByRole("radiogroup", { name: "Grade" });
    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio.getAttribute("aria-disabled")).not.toBe("true");
    }
    expect(
      (screen.getByRole("button", { name: "Record a grade" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.queryByText("You haven't met the prerequisites yet.")).toBeNull();
  });
});
