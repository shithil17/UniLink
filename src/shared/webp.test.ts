import { describe, expect, it } from "vite-plus/test";
import { parseWebp } from "./webp";
import { makeWebp } from "./webp.fixture";

describe("parseWebp", () => {
  it("reads the size of lossy, lossless and extended files", () => {
    for (const format of ["VP8", "VP8L", "VP8X"] as const) {
      expect(parseWebp(makeWebp({ format, width: 640, height: 480 }))).toEqual({
        ok: true,
        width: 640,
        height: 480,
        hasExif: false,
        hasXmp: false,
      });
    }
  });

  it("reports EXIF and XMP chunks, and the EXIF flag in the extended header", () => {
    expect(parseWebp(makeWebp({ format: "VP8X", exifChunk: true }))).toMatchObject({
      hasExif: true,
    });
    expect(parseWebp(makeWebp({ format: "VP8X", xmpChunk: true }))).toMatchObject({ hasXmp: true });
    expect(parseWebp(makeWebp({ format: "VP8X", exifFlag: true }))).toMatchObject({
      hasExif: true,
    });
  });

  it("rejects bytes that are not a WebP, and files cut short or with trailing data", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
    expect(parseWebp(png)).toEqual({ ok: false, reason: "not_webp" });
    const good = makeWebp();
    expect(parseWebp(good.slice(0, good.length - 2))).toEqual({ ok: false, reason: "truncated" });
    expect(parseWebp(Uint8Array.from([...good, 0]))).toEqual({ ok: false, reason: "truncated" });
  });
});
