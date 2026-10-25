// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { THEME_STORAGE_KEY, themes } from "../../../shared/themes";
import { ThemePicker } from "./ThemePicker";
import { ThemeProvider } from "./ThemeProvider";

function mount() {
  return render(
    <ThemeProvider>
      <ThemePicker />
    </ThemeProvider>,
  );
}

const radios = () => screen.getAllByRole("radio");
const checked = () => radios().filter((r) => r.getAttribute("aria-checked") === "true");

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(cleanup);

describe("ThemePicker", () => {
  it("is a radiogroup with one radio per palette and the active one checked", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "cherry-blossom");
    mount();
    expect(screen.getByRole("radiogroup", { name: "Color theme" })).toBeTruthy();
    expect(radios()).toHaveLength(themes.length);
    expect(checked()).toHaveLength(1);
    expect(checked()[0]?.textContent).toContain("Cherry Blossom");
    // A single tab stop, on the checked row.
    const stops = radios().filter((r) => r.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(checked()[0]);
  });

  it("moves the choice with the arrow keys and saves it", async () => {
    mount();
    const first = radios()[0]!;
    expect(first.getAttribute("aria-checked")).toBe("true");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    // The group moves focus in a microtask and the focused row becomes the choice.
    await waitFor(() => expect(checked()[0]).toBe(radios()[1]));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(themes[1]!.id);
    expect(document.documentElement.dataset.theme).toBe(themes[1]!.id);

    fireEvent.keyDown(radios()[1]!, { key: "ArrowUp" });
    await waitFor(() => expect(checked()[0]).toBe(radios()[0]));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(themes[0]!.id);
  });

  it("choosing a row writes unilink-theme", () => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name: /Night/ }));
    expect(localStorage.getItem("unilink-theme")).toBe("night");
    expect(checked()[0]?.textContent).toContain("Night");
  });
});
