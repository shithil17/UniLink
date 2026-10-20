// Builds tiny WebP containers for tests. Only the headers are real; the image data is filler.

export type FixtureOptions = {
  width?: number;
  height?: number;
  /** "VP8X" adds the extended header; the others write a bare image chunk. */
  format?: "VP8" | "VP8L" | "VP8X";
  exifChunk?: boolean;
  xmpChunk?: boolean;
  /** Sets the EXIF / XMP flags in the VP8X header without a chunk. */
  exifFlag?: boolean;
  /** Pads the file with an unknown chunk of this many bytes, to test the size limit. */
  padBytes?: number;
};

const ascii = (s: string) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));
const le = (n: number, bytes: number) =>
  Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff);

function chunk(kind: string, data: number[]): number[] {
  return [...ascii(kind), ...le(data.length, 4), ...data, ...(data.length % 2 ? [0] : [])];
}

export function makeWebp(opts: FixtureOptions = {}): Uint8Array {
  const { width = 800, height = 600, format = "VP8L" } = opts;
  const chunks: number[] = [];
  const add = (c: number[]) => {
    for (const b of c) chunks.push(b);
  };

  if (format === "VP8X") {
    const flags = (opts.exifChunk || opts.exifFlag ? 0x08 : 0) | (opts.xmpChunk ? 0x04 : 0);
    add(chunk("VP8X", [flags, 0, 0, 0, ...le(width - 1, 3), ...le(height - 1, 3)]));
  }
  if (format === "VP8") {
    add(chunk("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le(width, 2), ...le(height, 2), 0, 0]));
  } else {
    const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
    add(chunk("VP8L", [0x2f, ...le(bits >>> 0, 4), 0, 0]));
  }
  if (opts.exifChunk) add(chunk("EXIF", [1, 2, 3, 4]));
  if (opts.xmpChunk) add(chunk("XMP ", [1, 2, 3, 4]));
  if (opts.padBytes) add(chunk("JUNK", new Array<number>(opts.padBytes).fill(0)));

  return Uint8Array.from([
    ...ascii("RIFF"),
    ...le(chunks.length + 4, 4),
    ...ascii("WEBP"),
    ...chunks,
  ]);
}
