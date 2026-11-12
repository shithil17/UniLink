import { describe, expect, it } from "vite-plus/test";
import { parseMapParam } from "./useMapParam";

describe("parseMapParam", () => {
  it("keeps a short lowercase map name", () => {
    expect(parseMapParam("ride")).toBe("ride");
    expect(parseMapParam("pin-pickup")).toBe("pin-pickup");
  });

  it("drops anything else, so a hand-edited URL cannot open a map or break the page", () => {
    for (const bad of [undefined, null, 3, ["ride"], "", "Ride", "a b", "-ride", "x".repeat(40)]) {
      expect(parseMapParam(bad)).toBeUndefined();
    }
  });
});
