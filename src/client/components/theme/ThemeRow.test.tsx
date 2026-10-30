// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ThemeRow } from "./ThemeRow";
import { ThemeProvider } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(cleanup);

describe("ThemeRow", () => {
  it("shows the current theme, opens the picker in a Theme dialog and reflects a new choice", async () => {
    localStorage.setItem("unilink-theme", "cherry-blossom");
    render(
      <ThemeProvider>
        <ThemeRow />
      </ThemeProvider>,
    );
    const row = screen.getByRole("button", { name: /Theme\s*Cherry Blossom/ });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: "Theme" });
    expect(dialog.querySelector('[role="radiogroup"]')?.getAttribute("aria-label")).toBe(
      "Color theme",
    );
    fireEvent.click(screen.getByRole("radio", { name: /Night/ }));
    // The sheet stays open after choosing.
    expect(screen.getByRole("dialog", { name: "Theme" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /Theme\s*Night/ })).toBeTruthy();
  });
});
