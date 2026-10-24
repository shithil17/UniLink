// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./useDebouncedValue";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("passes a value on only after it stops changing", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: "" },
    });
    rerender({ v: "r" });
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    rerender({ v: "ra" });
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current).toBe("");
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe("ra");
  });
});
