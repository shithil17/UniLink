import { describe, expect, it } from "vite-plus/test";
import {
  RESOURCE_URL_MAX_LENGTH,
  URL_SHORTENER_HOSTS,
  isShareableResourceUrl,
  parseResourceUrl,
  resourceUrlProblem,
} from "./resourceUrl";

describe("isShareableResourceUrl", () => {
  it.each([
    "https://drive.google.com/file/d/abc123/view?usp=sharing",
    "https://www.youtube.com/playlist?list=PLabc123XYZ&si=qwerty",
    "https://www.samsungcloud.com/share/abc",
    "https://transfer.it/t/abc123",
    "https://1drv.ms/b/s!abc",
    "https://notes.some-student.dev/cse225/week-1",
    "https://DRIVE.GOOGLE.COM/file/d/abc",
    `https://example.com/search?q=${"a".repeat(300)}`,
    "https://notbit.ly/abc",
    "https://bit.ly.mysite.com/abc",
    "https://tinyurl.com.mysite.com/abc",
  ])("allows %s", (url) => {
    expect(isShareableResourceUrl(url)).toBe(true);
  });

  it.each([
    "http://drive.google.com/file/d/abc",
    "ftp://files.mysite.com/notes.pdf",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//drive.google.com/file",
    "drive.google.com/file/d/abc",
    "not a url",
    "",
  ])("refuses a value that is not an https link: %s", (url) => {
    expect(isShareableResourceUrl(url)).toBe(false);
  });

  it("refuses credentials, a custom port and a trailing-dot host", () => {
    expect(isShareableResourceUrl("https://user:pw@drive.google.com/file")).toBe(false);
    expect(isShareableResourceUrl("https://drive.google.com@mysite.com/file")).toBe(false);
    expect(isShareableResourceUrl("https://drive.google.com:8443/file")).toBe(false);
    expect(isShareableResourceUrl("https://drive.google.com./file")).toBe(false);
  });

  it.each([
    "https://192.168.0.1/notes.pdf",
    "https://8.8.8.8/notes.pdf",
    "https://2130706433/notes.pdf",
    "https://0x7f.0.0.1/notes.pdf",
    "https://[::1]/notes.pdf",
    "https://[2001:db8::1]/notes.pdf",
    "https://localhost/notes.pdf",
    "https://app.localhost/notes.pdf",
    "https://printer.local/notes.pdf",
    "https://wiki.internal/notes.pdf",
    "https://nas.lan/notes.pdf",
    "https://router.home.arpa/notes.pdf",
    "https://site.test/notes.pdf",
    "https://site.example/notes.pdf",
    "https://site.invalid/notes.pdf",
    "https://intranet/notes.pdf",
  ])("refuses a host that is not a public name: %s", (url) => {
    expect(isShareableResourceUrl(url)).toBe(false);
    expect(resourceUrlProblem(url)).toBe("invalid");
  });

  it("refuses a link over the length cap", () => {
    const long = `https://drive.google.com/file/d/${"a".repeat(RESOURCE_URL_MAX_LENGTH)}`;
    expect(isShareableResourceUrl(long)).toBe(false);
  });

  it("refuses every shortener, on the host itself and on a subdomain", () => {
    for (const host of URL_SHORTENER_HOSTS) {
      expect(resourceUrlProblem(`https://${host}/abc`)).toBe("shortener");
      expect(resourceUrlProblem(`https://www.${host}/abc`)).toBe("shortener");
    }
    expect(resourceUrlProblem("https://BIT.LY/abc")).toBe("shortener");
  });

  it("does not treat a look-alike of a shortener as one", () => {
    expect(resourceUrlProblem("https://notbit.ly/abc")).toBeNull();
    expect(resourceUrlProblem("https://bit.ly.mysite.com/abc")).toBeNull();
  });
});

describe("parseResourceUrl", () => {
  it("returns the parsed URL, trimmed", () => {
    expect(parseResourceUrl("  https://github.com/a/b  ")?.hostname).toBe("github.com");
    expect(parseResourceUrl("http://github.com/a/b")).toBeNull();
  });

  it("shows an international host in punycode, so a look-alike cannot pass for the real one", () => {
    expect(parseResourceUrl("https://gооgle.com/x")?.hostname).toBe("xn--ggle-55da.com");
  });
});
