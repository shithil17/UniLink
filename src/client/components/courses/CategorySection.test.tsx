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
  chosenCode: null,
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
  trails: null,
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

describe("CategorySection trails", () => {
  const trails = (
    over: Partial<NonNullable<Category["trails"]>>,
  ): NonNullable<Category["trails"]> => ({
    minFromOneTrail: 2,
    met: false,
    leading: null,
    trails: [
      { name: "Artificial Intelligence", done: 0, added: 0, courses: [] },
      { name: "Networks", done: 0, added: 0, courses: [] },
    ],
    ...over,
  });
  const electives = (t: Category["trails"]): Category => ({
    name: "Electives",
    required: 6,
    earned: 0,
    slots: [slot({ kind: "elective", code: "ELEC1", title: "Elective 1", credits: 3 })],
    trails: t,
  });
  const show = (t: Category["trails"]) =>
    render(<CategorySection category={electives(t)} onOpenSlot={() => {}} onAdd={() => {}} />);

  it("states the rule while no trail has a done course", () => {
    show(trails({}));
    expect(screen.getByText("Take at least 2 from one trail")).toBeTruthy();
  });

  it("shows the leading trail's progress", () => {
    show(
      trails({
        leading: "Artificial Intelligence",
        trails: [{ name: "Artificial Intelligence", done: 1, added: 1, courses: [] }],
      }),
    );
    expect(screen.getByText("Artificial Intelligence: 1 of 2 done, 1 added")).toBeTruthy();
  });

  it("says when a trail is met", () => {
    show(
      trails({
        met: true,
        leading: "Artificial Intelligence",
        trails: [{ name: "Artificial Intelligence", done: 2, added: 0, courses: [] }],
      }),
    );
    expect(screen.getByText("Trail met: Artificial Intelligence (2 of 2 done)")).toBeTruthy();
  });

  it("tells an empty slot to pick from a trail, and elsewhere says any discipline", () => {
    const { unmount } = show(trails({}));
    expect(screen.getByText("ELEC1 · Pick from a trail")).toBeTruthy();
    unmount();
    show(null);
    expect(screen.getByText("ELEC1 · Any discipline")).toBeTruthy();
    expect(screen.queryByText(/Take at least/)).toBeNull();
  });

  it("prints Non-credit instead of 0 / 0 cr when every slot is non-credit", () => {
    render(
      <CategorySection
        category={{
          name: "Internship",
          required: 0,
          earned: 0,
          slots: [slot({ code: "CSE498", title: "Internship", credits: 0, nonCredit: true })],
          trails: null,
        }}
        onOpenSlot={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText("Non-credit")).toBeTruthy();
    expect(screen.queryByText(/0 \/ 0/)).toBeNull();
  });
});

describe("CategorySection choice slots", () => {
  const choice = slot({
    code: "ENG115",
    title: "Introduction to Composition",
    alternatives: [{ code: "BEN205", title: "Bangla Language" }],
  });
  const section = (s: Slot) =>
    render(
      <CategorySection
        category={{ name: "GED", required: 3, earned: 0, slots: [s], trails: null }}
        onOpenSlot={() => {}}
        onAdd={() => {}}
      />,
    );

  it("joins the codes and titles until the student takes one", () => {
    section(choice);
    expect(screen.getByText("ENG115/BEN205")).toBeTruthy();
    expect(screen.getByText("Introduction to Composition / Bangla Language")).toBeTruthy();
  });

  it("shows the course taken once there is an attempt", () => {
    section({ ...choice, chosenCode: "BEN205", filledBy: "BEN205", status: "done" });
    expect(screen.getByText("BEN205")).toBeTruthy();
    expect(screen.getByText("Bangla Language")).toBeTruthy();
    expect(screen.queryByText("ENG115/BEN205")).toBeNull();
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
