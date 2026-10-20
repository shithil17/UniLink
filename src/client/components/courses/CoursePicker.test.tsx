// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CourseChoice } from "@/lib/courseSearch";
import { CoursePicker } from "./CoursePicker";

afterEach(cleanup);

const CHOICES: CourseChoice[] = [
  { code: "CSE115", title: "Programming Language I", status: "done" },
  { code: "CSE225", title: "Data Structures and Algorithms", status: "available" },
  { code: "MAT116", title: "Pre-Calculus", status: "available" },
];

function setup(value: string | null = null) {
  const onChange = vi.fn();
  render(<CoursePicker id="c" value={value} onChange={onChange} choices={CHOICES} />);
  return onChange;
}

const open = async (name: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("combobox", { name: "Search by code or title" });
};

const optionCodes = () =>
  screen.getAllByRole("option").map((o) => o.textContent?.match(/[A-Z]+\d+/)?.[0]);

describe("CoursePicker", () => {
  it("lists the courses the student can take first, then narrows them as they type", async () => {
    setup();
    const search = await open(/Pick a course/);
    expect(optionCodes()).toEqual(["CSE225", "MAT116", "CSE115"]);
    fireEvent.change(search, { target: { value: "data str" } });
    expect(optionCodes()).toEqual(["CSE225"]);
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(screen.getByText("No course matches that search.")).toBeTruthy();
  });

  it("picks a course by tapping it", async () => {
    const onChange = setup();
    const search = await open(/Pick a course/);
    fireEvent.change(search, { target: { value: "mat" } });
    fireEvent.click(screen.getByRole("option", { name: /MAT116/ }));
    expect(onChange).toHaveBeenCalledWith("MAT116");
  });

  it("picks with the keyboard: arrows move, Enter chooses", async () => {
    const onChange = setup();
    const search = await open(/Pick a course/);
    fireEvent.change(search, { target: { value: "cse" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    // "cse" lists CSE225 (can take) before CSE115 (done); one step down is CSE115.
    expect(onChange).toHaveBeenCalledWith("CSE115");
  });

  it("shows the chosen course with its title, and marks it in the list", async () => {
    setup("CSE225");
    await open(/CSE225/);
    const chosen = screen.getByRole("option", { selected: true });
    expect(chosen.textContent).toContain("CSE225");
  });
});
