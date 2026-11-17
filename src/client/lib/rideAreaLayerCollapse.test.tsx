// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { layerPadding, useLayerCollapse } from "./rideAreaMap";

type Area = { by: "pickup" | "destination"; id: number } | null;
const AREA: Area = { by: "pickup", id: 7 };

function setup(area: Area, detailId: number | null) {
  return renderHook(({ area, detailId }) => useLayerCollapse(area, detailId), {
    initialProps: { area, detailId },
  });
}

describe("useLayerCollapse", () => {
  it("starts open and stays collapsed until the layers change", () => {
    const { result, rerender } = setup(AREA, 1);
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    rerender({ area: AREA, detailId: 1 });
    expect(result.current[0]).toBe(true);
  });

  it("opens again for another ride, another area, or the detail closing back to the rides", () => {
    const { result, rerender } = setup(AREA, 1);
    act(() => result.current[1](true));
    rerender({ area: AREA, detailId: 2 });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    rerender({ area: AREA, detailId: null });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    rerender({ area: { by: "destination", id: 7 }, detailId: null });
    expect(result.current[0]).toBe(false);
  });

  it("is left alone while the last layer closes, so the exit does not jump", () => {
    const { result, rerender } = setup(AREA, null);
    act(() => result.current[1](true));
    rerender({ area: null, detailId: null });
    expect(result.current[0]).toBe(true);
    rerender({ area: AREA, detailId: null });
    expect(result.current[0]).toBe(false);
  });
});

describe("layerPadding", () => {
  it("leaves more room under a ride for an open sheet than for its peek strip", () => {
    const open = layerPadding(false);
    const peek = layerPadding(false, true);
    expect(typeof open === "object" && typeof peek === "object").toBe(true);
    if (typeof open === "object" && typeof peek === "object") {
      expect(peek.bottom).toBeLessThan(open.bottom);
      expect(peek.bottom).toBeGreaterThan(peek.top);
    }
  });

  it("ignores the peek on the docked layout", () => {
    expect(layerPadding(true, true)).toEqual(layerPadding(true));
  });
});
