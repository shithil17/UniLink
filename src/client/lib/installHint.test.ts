import { describe, expect, it } from "vite-plus/test";
import {
  INSTALL_HINT_STORAGE_KEY,
  readDismissed,
  saveDismissed,
  shouldShowInstallHint,
} from "./installHint";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DESKTOP_CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const base = { standalone: false, dismissed: false };

describe("shouldShowInstallHint", () => {
  it("shows in iOS Safari when not standalone and not dismissed", () => {
    expect(shouldShowInstallHint({ ...base, userAgent: IPHONE_SAFARI })).toBe(true);
  });

  it("shows in iPadOS Safari, which reports a Mac user agent", () => {
    expect(shouldShowInstallHint({ ...base, userAgent: IPAD_SAFARI, maxTouchPoints: 5 })).toBe(
      true,
    );
  });

  it("does not show in other iOS browsers", () => {
    for (const userAgent of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_INSTAGRAM]) {
      expect(shouldShowInstallHint({ ...base, userAgent })).toBe(false);
    }
  });

  it("does not show on Android or desktop", () => {
    for (const userAgent of [ANDROID_CHROME, DESKTOP_SAFARI, DESKTOP_CHROME]) {
      expect(shouldShowInstallHint({ ...base, userAgent })).toBe(false);
    }
  });

  it("does not show when already standalone", () => {
    expect(shouldShowInstallHint({ ...base, userAgent: IPHONE_SAFARI, standalone: true })).toBe(
      false,
    );
  });

  it("does not show once dismissed", () => {
    expect(shouldShowInstallHint({ ...base, userAgent: IPHONE_SAFARI, dismissed: true })).toBe(
      false,
    );
  });
});

describe("dismissal storage", () => {
  const throwing = () => {
    throw new Error("blocked");
  };

  it("round-trips through storage", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    expect(readDismissed(() => store)).toBe(false);
    saveDismissed(() => store);
    expect(data.get(INSTALL_HINT_STORAGE_KEY)).toBe("1");
    expect(readDismissed(() => store)).toBe(true);
  });

  it("does not crash when storage throws", () => {
    expect(readDismissed(throwing)).toBe(false);
    expect(() => saveDismissed(throwing)).not.toThrow();
    expect(
      readDismissed(() => ({
        getItem: throwing,
      })),
    ).toBe(false);
  });
});
