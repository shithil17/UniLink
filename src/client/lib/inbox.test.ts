import { describe, expect, it } from "vite-plus/test";
import { notificationType } from "../../shared/schemas/inbox";
import {
  badgeLabel,
  INBOX_BADGE_MAX,
  NOTIFICATION_HUE,
  notificationCopy,
  notificationHue,
  notificationTarget,
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

describe("notificationCopy for a removal", () => {
  it("names the kind and shows the moderator's reason", () => {
    const link = notificationCopy("content_removed", {
      kind: "resource_submission",
      reason: "Not course material",
    });
    expect(link.title).toBe("A moderator removed a link you sent to a request");
    expect(link.detail).toBe("Reason: Not course material");
    expect(
      notificationCopy("content_removed", { kind: "resource_request", reason: "Spam request" })
        .title,
    ).toBe("A moderator removed your request for materials");
  });

  it("names a removed ride", () => {
    const copy = notificationCopy("content_removed", { kind: "ride", reason: "Looks like a scam" });
    expect(copy.title).toBe("A moderator removed your ride");
    expect(copy.detail).toBe("Reason: Looks like a scam");
  });

  it("falls back to fixed words for a payload that does not parse", () => {
    const copy = notificationCopy("content_removed", { kind: "nope", reason: "x" });
    expect(copy.title).toBe("A moderator removed something you posted");
    expect(copy.detail).toBe("It was taken down by a moderator.");
  });
});

describe("notificationCopy for a moderator's decision", () => {
  it("tells the author of a link only the requester can see it, a request that others can", () => {
    const link = notificationCopy("post_approved", { targetType: "resource_submission" });
    expect(link.detail).toMatch(/student who asked can see/);
    expect(link.title).toBe("Your link was approved");
    expect(link.title).not.toMatch(/live/);
    expect(notificationCopy("post_approved", { targetType: "resource_request" }).title).toBe(
      "Your post is live",
    );
    expect(notificationCopy("post_approved", { targetType: "resource_request" }).detail).toMatch(
      /other students can see/,
    );
  });

  it("does not promise an edit-and-resend flow", () => {
    expect(notificationCopy("post_rejected").detail).not.toMatch(/edit|send it again/i);
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

describe("notificationTarget", () => {
  it("opens the submit screen for a request that matches you", () => {
    expect(notificationTarget("resource_requested", { requestId: 7 })).toEqual({
      to: "/resources/$requestId",
      params: { requestId: "7" },
    });
  });

  it("opens my requests for a link sent to my request", () => {
    expect(notificationTarget("resource_submitted", { requestId: 7 })).toEqual({
      to: "/resources",
    });
  });

  it("opens the Materials screen for removed content, and nowhere for an unknown kind", () => {
    expect(notificationTarget("content_removed", { kind: "resource_submission" })).toEqual({
      to: "/resources",
      search: { tab: "help" },
    });
    expect(notificationTarget("content_removed", { kind: "resource_request" })).toEqual({
      to: "/resources",
    });
    expect(notificationTarget("content_removed", { kind: "nope" })).toBeNull();
    expect(notificationTarget("content_removed", undefined)).toBeNull();
  });

  it("opens Materials for a moderator's decision, the Help tab for a link and never a request page", () => {
    for (const type of ["post_approved", "post_rejected"] as const) {
      expect(notificationTarget(type, { targetType: "resource_request", targetId: 9 })).toEqual({
        to: "/resources",
      });
      expect(notificationTarget(type, { targetType: "resource_submission", targetId: 9 })).toEqual({
        to: "/resources",
        search: { tab: "help" },
      });
      expect(notificationTarget(type, { targetType: "nope", targetId: 9 })).toBeNull();
      expect(notificationTarget(type, {})).toBeNull();
    }
  });

  it("goes nowhere for an accepted link, where the request is closed to everyone else", () => {
    expect(notificationTarget("resource_accepted", { requestId: 7 })).toBeNull();
  });

  it("goes nowhere when the request id is missing or not a positive whole number", () => {
    expect(notificationTarget("resource_requested", {})).toBeNull();
    expect(notificationTarget("resource_requested", { requestId: "7" })).toBeNull();
    expect(notificationTarget("resource_requested", { requestId: -1 })).toBeNull();
    expect(notificationTarget("resource_requested", undefined)).toBeNull();
  });

  it("has no screen for the kinds that are only read", () => {
    expect(notificationTarget("push_test", {})).toBeNull();
  });
});
