import { describe, expect, it } from "vite-plus/test";
import { notificationType } from "../../shared/schemas/inbox";
import {
  badgeLabel,
  INBOX_BADGE_MAX,
  NOTIFICATION_HUE,
  notificationCopy,
  notificationHue,
  timeAgo,
} from "./inbox";

describe("badgeLabel", () => {
  it("is empty at zero, the count up to the cap, then capped", () => {
    expect(badgeLabel(0)).toBe("");
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(INBOX_BADGE_MAX)).toBe(String(INBOX_BADGE_MAX));
    expect(badgeLabel(INBOX_BADGE_MAX + 1)).toBe(`${INBOX_BADGE_MAX}+`);
  });
});

describe("notificationCopy", () => {
  it("has words for every notification type", () => {
    for (const type of notificationType.options) {
      const copy = notificationCopy(type);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("notificationHue", () => {
  it("has no entry for a kind that does not exist", () => {
    expect(Object.keys(NOTIFICATION_HUE).sort()).toEqual([...notificationType.options].sort());
  });

  it("tints good news mint, bad news rose, a request sky, a link lilac, a match butter", () => {
    expect(notificationHue("post_approved")).toBe("mint");
    expect(notificationHue("resource_accepted")).toBe("mint");
    expect(notificationHue("post_rejected")).toBe("rose");
    expect(notificationHue("resource_requested")).toBe("sky");
    expect(notificationHue("resource_submitted")).toBe("lilac");
    expect(notificationHue("lost_found_possible_match")).toBe("butter");
    expect(notificationHue("push_test")).toBe("sky");
  });
});

describe("timeAgo", () => {
  const now = Date.UTC(2026, 9, 20, 12);
  it("steps through minutes, hours and days", () => {
    expect(timeAgo(now - 5_000, now)).toBe("Just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2 d ago");
  });
  it("falls back to a date after a week", () => {
    expect(timeAgo(Date.UTC(2026, 9, 1, 12), now)).toBe("1 Oct");
  });
});
