// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY, resolveTheme } from "../../../shared/themes";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./themeContext";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("cherry-red")}>pick</button>
    </div>
  );
}

function meta() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

function mount() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = '<meta name="theme-color" content="unset">';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("reads a saved theme, sets data-theme and the theme-color meta", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "cherry-blossom");
    const { getByTestId } = mount();
    expect(getByTestId("theme").textContent).toBe("cherry-blossom");
    expect(document.documentElement.dataset.theme).toBe("cherry-blossom");
    expect(meta()?.content).toBe(resolveTheme("cherry-blossom").bar);
  });

  it("ignores an unknown saved value and falls back to the default", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "hotdog-stand");
    const { getByTestId } = mount();
    expect(getByTestId("theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME_ID);
  });

  it("falls back when reading storage throws, and still switches themes", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    const { getByTestId, getByText } = mount();
    expect(getByTestId("theme").textContent).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    act(() => getByText("pick").click());
    expect(getByTestId("theme").textContent).toBe("cherry-red");
    expect(document.documentElement.dataset.theme).toBe("cherry-red");
  });

  it("saves a change and updates data-theme and the meta", () => {
    const { getByText } = mount();
    expect(meta()?.content).toBe(resolveTheme(DEFAULT_THEME_ID).bar);
    act(() => getByText("pick").click());
    expect(document.documentElement.dataset.theme).toBe("cherry-red");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("cherry-red");
    expect(meta()?.content).toBe(resolveTheme("cherry-red").bar);
  });

  it("creates the theme-color meta when the page has none", () => {
    document.head.innerHTML = "";
    mount();
    expect(meta()?.content).toBe(resolveTheme(DEFAULT_THEME_ID).bar);
  });
});
