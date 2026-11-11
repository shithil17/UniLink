import { describe, expect, it } from "vite-plus/test";
import { RESOURCE_URL_MAX_LENGTH, isAllowedResourceUrl, parseResourceUrl } from "./urlAllowlist";

describe("isAllowedResourceUrl", () => {
  it.each([
    "https://drive.google.com/file/d/abc123/view?usp=sharing",
    "https://docs.google.com/document/d/abc123/edit",
    "https://www.dropbox.com/s/abc/notes.pdf?dl=0",
    "https://onedrive.live.com/?id=abc",
    "https://1drv.ms/b/s!abc",
    "https://mega.nz/file/abc#key",
    "https://github.com/user/notes",
    "https://DRIVE.GOOGLE.COM/file/d/abc",
  ])("allows %s", (url) => {
    expect(isAllowedResourceUrl(url)).toBe(true);
  });

  it.each([
    "https://drive.google.com.evil.io/file/d/abc",
    "https://evil.io/drive.google.com",
    "https://evildrive.google.com.io",
    "https://notdropbox.com/s/abc",
    "https://dropbox.com.evil.io",
    "https://drive.google.com@evil.io/file",
    "https://evil.io#drive.google.com",
    "https://drive.google.com.evil.io@drive.google.com.evil.io/",
    "https://google.com/search?q=notes",
    "https://example.com/notes.pdf",
  ])("refuses the look-alike %s", (url) => {
    expect(isAllowedResourceUrl(url)).toBe(false);
  });

  it("refuses http, even on an allowed host", () => {
    expect(isAllowedResourceUrl("http://drive.google.com/file/d/abc")).toBe(false);
  });

  it.each([
    "ftp://drive.google.com/file",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//drive.google.com/file",
    "drive.google.com/file/d/abc",
    "not a url",
    "",
  ])("refuses a value that is not an https link: %s", (url) => {
    expect(isAllowedResourceUrl(url)).toBe(false);
  });

  it("refuses credentials, a custom port and a trailing-dot host", () => {
    expect(isAllowedResourceUrl("https://user:pw@drive.google.com/file")).toBe(false);
    expect(isAllowedResourceUrl("https://drive.google.com:8443/file")).toBe(false);
    expect(isAllowedResourceUrl("https://drive.google.com./file")).toBe(false);
  });

  it("refuses a link over the length cap", () => {
    const long = `https://drive.google.com/file/d/${"a".repeat(RESOURCE_URL_MAX_LENGTH)}`;
    expect(isAllowedResourceUrl(long)).toBe(false);
  });

  it("returns the parsed URL for an allowed link, trimmed", () => {
    expect(parseResourceUrl("  https://github.com/a/b  ")?.hostname).toBe("github.com");
    expect(parseResourceUrl("http://github.com/a/b")).toBeNull();
  });
});
