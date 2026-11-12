import { describe, expect, it } from "vite-plus/test";
import { removableReportTargets } from "../shared/schemas/common";
import { softDeleteTargets } from "./softDelete";

describe("removable report targets", () => {
  it("are exactly the content types softDelete() knows, so Remove is never offered for one it would refuse", () => {
    expect([...removableReportTargets].sort()).toEqual(Object.keys(softDeleteTargets).sort());
  });
});
