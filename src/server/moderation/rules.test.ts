import { describe, expect, it } from "vite-plus/test";
import { makeWebp } from "../../shared/webp.fixture";
import { limits } from "../limits";
import { isAllowedHost, passesLuhn, redactText, runRules } from "./rules";

const rulesOf = (
  texts: string[],
  rest: Parameters<typeof runRules>[0] extends infer T ? Partial<T> : never = {},
) => runRules({ texts, ...rest }).flags.map((f) => f.rule);

describe("student IDs", () => {
  it("catches an ID written plainly, with spaces and with dashes", () => {
    for (const text of [
      "my id is 2212345042",
      "my id is 221 2345 042",
      "my id is 221-2345-042",
      "my id is 22 1 2345 0 42",
      "id: 221 - 2345 - 042 please",
    ]) {
      expect(rulesOf([text]), text).toEqual(["student_id"]);
    }
  });

  it("catches an ID typed in Bangla digits, and blanks it in the snapshot", () => {
    const result = runRules({ texts: ["আমার আইডি ২২১২৩৪৫০৪২"] });
    expect(result.flags.map((f) => f.rule)).toEqual(["student_id"]);
    expect(result.redactedText).not.toContain("২২১২৩৪৫০৪২");
  });

  it("does not flag a Bangladeshi phone number or ordinary numbers", () => {
    expect(rulesOf(["call 01712345678", "room 304, 25 seats, 1200 taka"])).toEqual([]);
  });

  it("blanks the ID in the snapshot", () => {
    const { redactedText } = runRules({ texts: ["id 221-2345-042 thanks"] });
    expect(redactedText).toBe("id [redacted] thanks");
    expect(redactedText).not.toMatch(/2345/);
  });
});

describe("card numbers", () => {
  it("catches a Luhn-valid card number plain or in groups", () => {
    expect(passesLuhn("4111111111111111")).toBe(true);
    for (const text of [
      "card 4111111111111111",
      "card 4111 1111 1111 1111",
      "card 4111-1111-1111-1111",
    ]) {
      expect(rulesOf([text]), text).toEqual(["card_number"]);
    }
  });

  it("does not flag a number that fails Luhn", () => {
    expect(rulesOf(["card 4111 1111 1111 1112"])).toEqual([]);
  });

  it("does not flag a Bangladeshi phone number in text, even when its digits pass Luhn", () => {
    // 8801712345670 is +880 1712 345670 which is Luhn-valid, so only the phone exemption saves it.
    expect(passesLuhn("8801712345670")).toBe(true);
    for (const text of [
      "call 8801712345670",
      "call +880 1712 345670",
      "call +880-1712-345670 after 5",
      "call 01712345670 or 01812345678",
    ]) {
      expect(rulesOf([text]), text).toEqual([]);
    }
  });
});

describe("URLs", () => {
  it("lets allowlisted hosts and their subdomains through", () => {
    expect(
      rulesOf(["notes at https://docs.google.com/document/d/1 and www.northsouth.edu/cse"]),
    ).toEqual([]);
    expect(isAllowedHost("sites.google.com")).toBe(true);
  });

  it("flags a link that is not on the allowlist, with or without a scheme", () => {
    for (const text of [
      "win big at https://free-money.example.com/now",
      "visit cheap-phones.xyz today",
      "see www.evil.io",
    ]) {
      expect(rulesOf([text]), text).toEqual(["url"]);
    }
  });

  it("flags look-alike hosts", () => {
    expect(isAllowedHost("google.com.evil.io")).toBe(false);
    expect(isAllowedHost("notgoogle.com")).toBe(false);
    expect(rulesOf(["https://drive.google.com.evil.io/x"])).toEqual(["url"]);
    expect(rulesOf(["https://google.com@evil.io/x"])).toEqual(["url"]);
  });

  it("does not mistake an email address or a file name for a link", () => {
    expect(rulesOf(["mail me at a.b@gmail.com", "see lecture.pdf"])).toEqual([]);
  });
});

describe("contact format", () => {
  it("accepts well-formed contacts and flags a bad one", () => {
    const ok = { phone: "+8801712345678", whatsapp: "https://wa.me/8801712345678" };
    expect(rulesOf(["hi"], { contacts: ok })).toEqual([]);
    expect(rulesOf(["hi"], { contacts: { phone: "01712345678" } })).toEqual(["contact_format"]);
    expect(rulesOf(["hi"], { contacts: { messenger: "http://evil.io/x" } })).toEqual([
      "contact_format",
    ]);
  });
});

describe("length limits", () => {
  it("accepts text at the limit and flags text over it", () => {
    expect(rulesOf(["a".repeat(limits.screen.textMaxLength)])).toEqual([]);
    expect(rulesOf(["a".repeat(limits.screen.textMaxLength + 1)])).toEqual(["length"]);
  });
});

describe("banned words", () => {
  it("flags a banned word under its own category, ignoring case, spacing tricks and width", () => {
    expect(runRules({ texts: ["selling YABA cheap"] }).category).toBe("prohibited_item");
    expect(runRules({ texts: ["selling Ｙａｂａ"] }).category).toBe("prohibited_item");
    expect(runRules({ texts: ["selling y​aba"] }).category).toBe("prohibited_item");
    expect(runRules({ texts: ["double  your money now"] }).category).toBe("scam_or_spam");
    expect(runRules({ texts: ["just kys"] }).category).toBe("abuse_or_harassment");
  });

  it("matches whole words only", () => {
    expect(rulesOf(["the yabasco sauce", "skyscraper kyst"])).toEqual([]);
  });

  it("ranks personal data above the other categories", () => {
    expect(runRules({ texts: ["yaba 2212345042"] }).category).toBe("personal_data");
  });
});

describe("images", () => {
  it("accepts a clean WebP within the limits", () => {
    expect(rulesOf(["a bike"], { images: [makeWebp()] })).toEqual([]);
  });

  it("flags bytes that are not WebP", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
    expect(rulesOf(["a bike"], { images: [png] })).toEqual(["image"]);
  });

  it("flags a file over the byte limit", () => {
    const big = makeWebp({ format: "VP8X", padBytes: limits.screen.imageMaxBytes });
    expect(big.length).toBeGreaterThan(limits.screen.imageMaxBytes);
    expect(rulesOf(["a bike"], { images: [big] })).toEqual(["image"]);
  });

  it("flags dimensions over the limit", () => {
    const wide = makeWebp({ width: limits.screen.imageMaxSidePx + 1 });
    expect(rulesOf(["a bike"], { images: [wide] })).toEqual(["image"]);
    expect(
      rulesOf(["a bike"], { images: [makeWebp({ width: limits.screen.imageMaxSidePx })] }),
    ).toEqual([]);
  });

  it("flags an EXIF or XMP chunk as personal data", () => {
    for (const opts of [{ exifChunk: true }, { xmpChunk: true }] as const) {
      const result = runRules({
        texts: ["a bike"],
        images: [makeWebp({ format: "VP8X", ...opts })],
      });
      expect(result.flags).toEqual([{ rule: "image", category: "personal_data", index: 0 }]);
      expect(result.category).toBe("personal_data");
    }
  });

  it("flags too many photos", () => {
    const images = Array.from({ length: limits.screen.imagesMax + 1 }, () => makeWebp());
    expect(rulesOf(["a bike"], { images })).toEqual(["image"]);
  });
});

describe("clean text", () => {
  it("has no flags and the fine category", () => {
    const result = runRules({ texts: ["Lost a blue umbrella near the library, 3rd floor."] });
    expect(result).toMatchObject({ flags: [], category: "fine" });
  });
});

describe("redactText", () => {
  it("blanks student IDs and card numbers and leaves the rest, phone numbers included", () => {
    expect(redactText("id 221 2345 042 ok")).toBe("id [redacted] ok");
    expect(redactText("card 4111 1111 1111 1111.")).toBe("card [redacted].");
    expect(redactText("call 01712345678 today")).toBe("call 01712345678 today");
  });

  it("does not scan text over the length limit", () => {
    expect(redactText("2212345042 ".repeat(1000))).toBe("[text too long]");
  });
});
