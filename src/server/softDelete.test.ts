import { describe, expect, it } from "vite-plus/test";
import { removableReportTargets } from "../shared/schemas/common";
import { removedContentKind } from "../shared/schemas/inbox";
import { softDeleteTargets } from "./softDelete";

describe("removable report targets", () => {
  it("are exactly the content types softDelete() knows, so Remove is never offered for one it would refuse", () => {
    expect([...removableReportTargets].sort()).toEqual(Object.keys(softDeleteTargets).sort());
  });
});

describe("removed content kinds", () => {
  it("are exactly the soft-delete targets, so every removal has words for its notice", () => {
    expect([...removedContentKind.options].sort()).toEqual(Object.keys(softDeleteTargets).sort());
  });
});
