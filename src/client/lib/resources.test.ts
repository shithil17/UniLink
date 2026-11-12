import { describe, expect, it } from "vite-plus/test";
import {
  RESOURCE_EXPIRY_MAX_MS,
  RESOURCE_EXPIRY_MIN_MS,
  RESOURCE_FULFILLED_KEEP_MS,
} from "../../shared/schemas/resources";
import { ApiError } from "./api";
import {
  acceptLinkConfirm,
  DEFAULT_EXPIRY_MS,
  durationWords,
  EXPIRY_CHOICES,
  expiryLine,
  linkHost,
  postFailure,
  purgeNotice,
  safeLink,
  timeLeft,
} from "./resources";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 12, 6);

describe("durationWords", () => {
  it("names hours, days and whole months", () => {
    expect(durationWords(HOUR)).toBe("1 hour");
    expect(durationWords(3 * HOUR)).toBe("3 hours");
    expect(durationWords(DAY)).toBe("1 day");
    expect(durationWords(14 * DAY)).toBe("14 days");
    expect(durationWords(90 * DAY)).toBe("3 months");
    expect(durationWords(30 * DAY)).toBe("1 month");
  });
});

describe("expiry choices", () => {
  it("stay inside what the server accepts, with room under the maximum", () => {
    expect(EXPIRY_CHOICES.length).toBeGreaterThan(0);
    for (const c of EXPIRY_CHOICES) {
      expect(c.ms).toBeGreaterThanOrEqual(RESOURCE_EXPIRY_MIN_MS);
      expect(c.ms).toBeLessThan(RESOURCE_EXPIRY_MAX_MS);
    }
  });

  it("offers the default", () => {
    expect(EXPIRY_CHOICES.map((c) => c.ms)).toContain(DEFAULT_EXPIRY_MS);
  });
});

describe("purgeNotice", () => {
  it("states the keep period from the shared limit, not a typed number", () => {
    expect(purgeNotice().fulfilled).toContain(durationWords(RESOURCE_FULFILLED_KEEP_MS));
    expect(purgeNotice().fulfilled).toContain("3 months");
  });

  it("says an open request is deleted when it expires", () => {
    expect(purgeNotice().open).toMatch(/expires/);
    expect(purgeNotice().open).toMatch(/deleted/);
  });
});

describe("timeLeft", () => {
  it("counts down in days, then hours, then under an hour", () => {
    expect(timeLeft(NOW + 3 * DAY + HOUR, NOW)).toBe("3 days left");
    expect(timeLeft(NOW + DAY, NOW)).toBe("1 day left");
    expect(timeLeft(NOW + 5 * HOUR, NOW)).toBe("5 hours left");
    expect(timeLeft(NOW + HOUR / 2, NOW)).toBe("Under an hour left");
    expect(timeLeft(NOW - 1, NOW)).toBe("");
  });
});

describe("expiryLine", () => {
  it("tells an open request when it expires and that it is then deleted", () => {
    const line = expiryLine(
      { state: "open", expiresAt: NOW + 2 * DAY + HOUR, fulfilledAt: null },
      NOW,
    );
    expect(line).toContain("2 days left");
    expect(line).toContain("Expires 14 Nov, 1:00 pm");
    expect(line).toContain("then it is deleted");
  });

  it("tells a fulfilled request the day it is deleted, the keep period after fulfilment", () => {
    const fulfilledAt = Date.UTC(2026, 10, 1, 6);
    const line = expiryLine({ state: "fulfilled", expiresAt: NOW, fulfilledAt }, NOW);
    expect(line).toContain("Fulfilled 1 Nov");
    expect(line).toContain("Deleted on 30 Jan");
  });

  it("says an expired request is cleared automatically", () => {
    const line = expiryLine({ state: "expired", expiresAt: NOW - DAY, fulfilledAt: null }, NOW);
    expect(line).toContain("Expired 11 Nov");
    expect(line).toContain("deleted automatically");
  });
});

describe("safeLink", () => {
  it("passes a safe https link and names its host", () => {
    const url = "https://www.dropbox.com/s/abc/notes.pdf";
    expect(safeLink(url)).toBe(url);
    expect(linkHost(url)).toBe("dropbox.com");
  });

  it("passes a link from any public site", () => {
    const url = "https://www.youtube.com/playlist?list=PLabc";
    expect(safeLink(url)).toBe(url);
    expect(linkHost(url)).toBe("youtube.com");
  });

  it("refuses http, look-alike hosts and script links, so they never become an href", () => {
    expect(safeLink("http://drive.google.com/x")).toBeNull();
    expect(safeLink("https://bit.ly/x")).toBeNull();
    expect(safeLink("https://192.168.0.1/x")).toBeNull();
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(linkHost("https://bit.ly/x")).toBe("");
  });
});

describe("postFailure", () => {
  it("gives a new account's 429 its own title and the server's sentence beneath", () => {
    const err = new ApiError(429, {
      error: "new_account",
      message: "New accounts can post after their first day. Try again later.",
    });
    expect(postFailure(err)).toEqual({
      title: "New accounts can't post yet",
      description: "New accounts can post after their first day. Try again later.",
    });
  });

  it("uses the server's message for any other refusal", () => {
    const err = new ApiError(409, { error: "closed", message: "This request is no longer open." });
    expect(postFailure(err)).toEqual({ title: "This request is no longer open." });
  });
});

describe("acceptLinkConfirm", () => {
  it("names the sender and says accepting closes the request and when it is deleted", () => {
    const c = acceptLinkConfirm("sam", async () => {});
    expect(c.facts).toEqual([{ label: "Sent by", value: "sam" }]);
    expect(c.lead).toMatch(/closes your request/);
    expect(c.effects.join(" ")).toContain("3 months");
  });
});
