import { describe, expect, it } from "vite-plus/test";
import { notificationCopy } from "./notificationCopy";
import { rejectReasonMessage, rejectReasonMessages } from "./rejectReasons";
import { reasonCategory } from "./schemas/common";

describe("reject reason messages", () => {
  it("has a short, plain message for every category and none of them names a score or a rule", () => {
    for (const category of reasonCategory.options) {
      const message = rejectReasonMessage(category);
      expect(message.length, category).toBeGreaterThan(10);
      expect(message.length, category).toBeLessThan(200);
      expect(message, category).not.toMatch(/\d|score|confidence|rule|regex|luhn|banned word/i);
    }
    expect(Object.keys(rejectReasonMessages).sort()).toEqual([...reasonCategory.options].sort());
  });

  it("shows the category message in a rejection notification, and only for a known category", () => {
    expect(notificationCopy("post_rejected", { category: "personal_data" }).detail).toBe(
      rejectReasonMessage("personal_data"),
    );
    const generic = notificationCopy("post_rejected").detail;
    expect(notificationCopy("post_rejected", { category: "<b>hi</b>" }).detail).toBe(generic);
    expect(notificationCopy("post_approved", { category: "personal_data" })).toEqual(
      notificationCopy("post_approved"),
    );
  });
});
