// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title, body and action", () => {
    render(
      <EmptyState
        title="No classes today"
        description="Add your routine to see what is next."
        action={<button type="button">Add a class</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No classes today" })).toBeTruthy();
    expect(screen.getByText("Add your routine to see what is next.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a class" })).toBeTruthy();
  });

  it("leaves out the body and action when not given", () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
