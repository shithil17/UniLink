// WebP header parser. It reads the container only (magic, size, chunk list, canvas size) and never
// decodes pixels, so it is cheap enough for a Worker and the browser can check its own output with it.
// The server limits (bytes, dimensions) are applied by the caller; this file only reports what the file is.

export type WebpInfo = {
  width: number;
  height: number;
  /** An `EXIF` chunk, or the EXIF flag in the `VP8X` header, is present. Location data lives here. */
  hasExif: boolean;
  /** An `XMP ` chunk, or the XMP flag in the `VP8X` header, is present. */
  hasXmp: boolean;
};

export type WebpParse =
  | ({ ok: true } & WebpInfo)
  | { ok: false; reason: "not_webp" | "truncated" | "malformed" };

const RIFF_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

const fourcc = (b: Uint8Array, at: number) =>
  String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u32 = (b: Uint8Array, at: number) => (u24(b, at) | (b[at + 3] << 24)) >>> 0;

/** Canvas size from the first image chunk, for files without a `VP8X` header. */
function imageChunkSize(kind: string, b: Uint8Array, at: number, size: number) {
  if (
    kind === "VP8 " &&
    size >= 10 &&
    b[at + 3] === 0x9d &&
    b[at + 4] === 0x01 &&
    b[at + 5] === 0x2a
  ) {
    return { width: u16(b, at + 6) & 0x3fff, height: u16(b, at + 8) & 0x3fff };
  }
  if (kind === "VP8L" && size >= 5 && b[at] === 0x2f) {
    const bits = u32(b, at + 1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * Parses a WebP file. The RIFF size must match the byte length exactly, so nothing can hide after the
 * last chunk. Chunks are walked top level only, which is where `EXIF` and `XMP ` live.
 */
export function parseWebp(bytes: Uint8Array): WebpParse {
  if (
    bytes.length < RIFF_HEADER_BYTES ||
    fourcc(bytes, 0) !== "RIFF" ||
    fourcc(bytes, 8) !== "WEBP"
  ) {
    return { ok: false, reason: "not_webp" };
  }
  if (u32(bytes, 4) + CHUNK_HEADER_BYTES !== bytes.length)
    return { ok: false, reason: "truncated" };

  let hasExif = false;
  let hasXmp = false;
  let canvas: { width: number; height: number } | null = null;
  let imageSize: { width: number; height: number } | null = null;

  let at = RIFF_HEADER_BYTES;
  while (at < bytes.length) {
    if (at + CHUNK_HEADER_BYTES > bytes.length) return { ok: false, reason: "malformed" };
    const kind = fourcc(bytes, at);
    const size = u32(bytes, at + 4);
    const data = at + CHUNK_HEADER_BYTES;
    // Chunk data is padded to an even length; the last chunk's pad byte may be missing in sloppy files.
    if (data + size > bytes.length) return { ok: false, reason: "malformed" };

    if (kind === "EXIF") hasExif = true;
    else if (kind === "XMP ") hasXmp = true;
    else if (kind === "VP8X" && size >= 10) {
      hasExif ||= (bytes[data] & VP8X_EXIF_FLAG) !== 0;
      hasXmp ||= (bytes[data] & VP8X_XMP_FLAG) !== 0;
      canvas = { width: u24(bytes, data + 4) + 1, height: u24(bytes, data + 7) + 1 };
    } else imageSize ??= imageChunkSize(kind, bytes, data, size);

    at = data + size + (size % 2);
  }

  const dims = canvas ?? imageSize;
  if (!dims) return { ok: false, reason: "malformed" };
  return { ok: true, ...dims, hasExif, hasXmp };
}
