import { describe, expect, it } from "vite-plus/test";
import { reasonCategory } from "../../shared/schemas/common";
import { ruleName } from "../../shared/schemas/moderation";
import { categoryLabel, confidenceLabel, postTypeLabel, ruleLabel } from "./modQueue";

describe("mod queue labels", () => {
  it("has words for every category and rule", () => {
    for (const c of reasonCategory.options) expect(categoryLabel(c)).not.toBe("");
    for (const r of ruleName.options) expect(ruleLabel(r)).not.toBe("");
  });

  it("prints confidence as a whole percent, or nothing", () => {
    expect(confidenceLabel(0.644)).toBe("64%");
    expect(confidenceLabel(0)).toBe("0%");
    expect(confidenceLabel(null)).toBeNull();
  });

  it("turns a post type key into words", () => {
    expect(postTypeLabel("lost_found")).toBe("lost found");
  });
});
