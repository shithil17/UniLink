// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import { CategorySection, ExtrasSection } from "./CategorySection";

afterEach(cleanup);

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];

const slot = (over: Partial<Slot>): Slot => ({
  kind: "course",
  code: "CSE115",
  title: "Programming Language I",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  status: "available",
  filledBy: null,
  waived: false,
  studentCourse: null,
  ...over,
});

const category: Category = {
  name: "Core",
  required: 9,
  earned: 3,
  slots: [
    slot({ status: "done" }),
    slot({ code: "CSE225", title: "Data Structures", status: "locked" }),
    slot({ code: "ENG102", title: "English", status: "done", waived: true }),
    slot({ kind: "elective", code: "ELEC", title: "Open elective", credits: 3 }),
  ],
};

describe("CategorySection", () => {
  it("marks every row with its state by shape and label, and prints totals", () => {
    const { container } = render(
      <CategorySection category={category} onOpenSlot={() => {}} onAdd={() => {}} />,
    );
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(rows[0]).getByRole("img", { name: "Done" })).toBeTruthy();
    expect(within(rows[1]).getByRole("img", { name: "Locked" })).toBeTruthy();
    expect(within(rows[2]).getByRole("img", { name: "Waived" })).toBeTruthy();
    expect(container.querySelectorAll("[data-shape]")).toHaveLength(4);
    expect(screen.getByText("3 / 9 cr")).toBeTruthy();
  });

  it("opens a slot on tap and adds a course from an open elective", () => {
    const onOpenSlot = vi.fn();
    const onAdd = vi.fn();
    render(<CategorySection category={category} onOpenSlot={onOpenSlot} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /Data Structures/ }));
    expect(onOpenSlot).toHaveBeenCalledWith(category.slots[1]);
    fireEvent.click(screen.getByRole("button", { name: "Add course" }));
    expect(onAdd).toHaveBeenCalledWith("Core");
  });
});

describe("ExtrasSection", () => {
  it("shows a student course as done or open, with Excluded in words", () => {
    render(
      <ExtrasSection
        extras={[
          {
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
        ]}
        onOpen={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "Available" })).toBeTruthy();
    expect(screen.getByText("Excluded")).toBeTruthy();
  });
});
