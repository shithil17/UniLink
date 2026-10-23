// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { VIEW_FADE_MS, useViewFade } from "./useViewFade";

const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }) as MediaQueryList);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useViewFade", () => {
  it("fades out, swaps the view after 110ms, then fades back in", () => {
    motion(false);
    const { result, rerender } = renderHook(({ v }) => useViewFade(v), {
      initialProps: { v: "week" },
    });
    expect(result.current).toEqual({ shown: "week", fading: false });

    rerender({ v: "month" });
    expect(result.current).toEqual({ shown: "week", fading: true });

    act(() => {
      vi.advanceTimersByTime(VIEW_FADE_MS - 1);
    });
    expect(result.current.shown).toBe("week");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.shown).toBe("month");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toEqual({ shown: "month", fading: false });
  });

  it("puts the page back where it was after the swap", () => {
    motion(false);
    Object.defineProperty(window, "scrollY", { value: 240, configurable: true });
    const { rerender } = renderHook(({ v }) => useViewFade(v), { initialProps: { v: "week" } });
    rerender({ v: "day" });
    act(() => {
      vi.advanceTimersByTime(VIEW_FADE_MS);
    });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it("goes back to the old view without swapping when asked within the fade", () => {
    motion(false);
    const { result, rerender } = renderHook(({ v }) => useViewFade(v), {
      initialProps: { v: "week" },
    });
    rerender({ v: "day" });
    rerender({ v: "week" });
    act(() => {
      vi.advanceTimersByTime(VIEW_FADE_MS * 2);
    });
    expect(result.current).toEqual({ shown: "week", fading: false });
  });

  it("swaps at once with no fade under reduced motion", () => {
    motion(true);
    const { result, rerender } = renderHook(({ v }) => useViewFade(v), {
      initialProps: { v: "week" },
    });
    rerender({ v: "month" });
    expect(result.current).toEqual({ shown: "month", fading: false });
  });
});
