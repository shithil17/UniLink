// @vitest-environment happy-dom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { resetStagger, staggerRow, useStagger } from "./useStagger";

beforeEach(resetStagger);
afterEach(cleanup);

describe("useStagger", () => {
  it("plays on the first visit to a route and not on the second", () => {
    const first = renderHook(() => useStagger("home"));
    expect(first.result.current).toBe(true);
    first.unmount();

    const second = renderHook(() => useStagger("home"));
    expect(second.result.current).toBe(false);
  });

  it("keeps each route's first visit for itself", () => {
    renderHook(() => useStagger("home")).unmount();
    expect(renderHook(() => useStagger("courses")).result.current).toBe(true);
  });

  it("does not stop a screen's entrance mid-visit when it re-renders", () => {
    const view = renderHook(() => useStagger("inbox"));
    view.rerender();
    expect(view.result.current).toBe(true);
  });

  it("plays again after a reset, like a new session", () => {
    renderHook(() => useStagger("home")).unmount();
    resetStagger();
    expect(renderHook(() => useStagger("home")).result.current).toBe(true);
  });
});

describe("staggerRow", () => {
  it("sets the row position the CSS reads", () => {
    expect(staggerRow(3)).toEqual({ "--k": 3 });
  });
});
