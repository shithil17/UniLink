import { describe, expect, it } from "vite-plus/test";
import { decidePushState, keyToBytes, type PushEnv } from "./push";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const base: PushEnv = {
  userAgent: ANDROID,
  standalone: false,
  supported: true,
  permission: "default",
  subscribed: false,
};

describe("decidePushState", () => {
  it("is off on a supported browser that has not been asked yet", () => {
    expect(decidePushState(base)).toBe("off");
  });

  it("is on only with a subscription and granted permission", () => {
    expect(decidePushState({ ...base, permission: "granted", subscribed: true })).toBe("on");
    expect(decidePushState({ ...base, permission: "granted", subscribed: false })).toBe("off");
    expect(decidePushState({ ...base, permission: "default", subscribed: true })).toBe("off");
  });

  it("is denied when the browser blocks notifications, even with a stale subscription", () => {
    expect(decidePushState({ ...base, permission: "denied", subscribed: true })).toBe("denied");
  });

  it("is unsupported when the browser cannot do push", () => {
    expect(decidePushState({ ...base, supported: false })).toBe("unsupported");
  });

  it("asks iOS users to add the app to the Home Screen first, even though Safari hides PushManager", () => {
    expect(decidePushState({ ...base, userAgent: IPHONE, supported: false })).toBe("needs-install");
    expect(decidePushState({ ...base, userAgent: IPHONE, supported: true })).toBe("needs-install");
  });

  it("treats the installed iOS app like any supported browser", () => {
    expect(decidePushState({ ...base, userAgent: IPHONE, standalone: true })).toBe("off");
    expect(
      decidePushState({ ...base, userAgent: IPHONE, standalone: true, supported: false }),
    ).toBe("unsupported");
  });
});

describe("keyToBytes", () => {
  it("decodes base64url without padding", () => {
    // 0xfb 0xff 0xfe uses the url-safe characters "-" and "_".
    expect([...keyToBytes("-__-")]).toEqual([0xfb, 0xff, 0xfe]);
    expect([...keyToBytes("AQID")]).toEqual([1, 2, 3]);
    expect([...keyToBytes("AQI")]).toEqual([1, 2]);
  });
});
