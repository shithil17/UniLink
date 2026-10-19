// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import { CourseSheet } from "./CourseSheet";

afterEach(cleanup);

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
  it("shows a slot's alternatives, readable prerequisites and the attempt form", () => {
    renderSheet({ type: "slot", slot });
    expect(screen.getByText("CSE115 and (MAT120 or 30 credits completed)")).toBeTruthy();
    expect(screen.getByText("CSE226 Data Structures II")).toBeTruthy();
    expect(screen.getByText("Prerequisites are not met yet.")).toBeTruthy();
    expect(screen.getByLabelText("Grade")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save grade" })).toBeTruthy();
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
});
