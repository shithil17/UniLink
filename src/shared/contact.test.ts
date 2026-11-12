import { describe, expect, it } from "vite-plus/test";
import {
  badContactKinds,
  CONTACT_MAX_LENGTH,
  CONTACT_MESSAGES,
  CONTACT_REQUIRED_MESSAGE,
  hasContact,
  isValidContact,
} from "./contact";
import { contacts } from "./schemas/common";

describe("phone", () => {
  it.each(["+8801712345678", "+8801312345678", "+8801912345678"])("accepts %s", (v) => {
    expect(isValidContact("phone", v)).toBe(true);
  });
  it.each([
    "01712345678", // no country code
    "8801712345678", // no plus
    "+8801212345678", // 2 is not a mobile prefix
    "+880171234567", // one digit short
    "+88017123456789", // one digit long
    "+8801712 345678", // space
    "+8801712345678 ", // trailing space is the schema's job to trim, not the pattern's
    "+441712345678", // not Bangladesh
  ])("refuses %s", (v) => {
    expect(isValidContact("phone", v)).toBe(false);
  });
});

describe("whatsapp", () => {
  it.each(["https://wa.me/8801712345678", "https://wa.me/+8801712345678"])("accepts %s", (v) => {
    expect(isValidContact("whatsapp", v)).toBe(true);
  });
  it.each([
    "http://wa.me/8801712345678", // not https
    "https://wa.me/",
    "https://wa.me/12345", // too short to be a number
    "https://wa.me/abc",
    "https://wa.me.evil.com/8801712345678", // look-alike host
    "https://evil.com/wa.me/8801712345678",
    "wa.me/8801712345678",
    "javascript:alert(1)",
  ])("refuses %s", (v) => {
    expect(isValidContact("whatsapp", v)).toBe(false);
  });
});

describe("messenger and facebook", () => {
  it.each([
    "https://m.me/some.one",
    "https://facebook.com/some.one",
    "https://www.facebook.com/profile.php",
    "https://facebook.com/groups/nsu/posts",
  ])("accepts %s", (v) => {
    expect(isValidContact("messenger", v)).toBe(true);
  });
  it.each([
    "http://m.me/some.one",
    "https://m.me/",
    "https://m.me.evil.com/x",
    "https://evilfacebook.com/x",
    "https://facebook.com.evil.com/x",
    "https://twitter.com/x",
    "https://facebook.com/a b",
    "data:text/html,hi",
  ])("refuses %s", (v) => {
    expect(isValidContact("messenger", v)).toBe(false);
  });
});

describe("badContactKinds and hasContact", () => {
  it("names only the kinds that are present and badly formed", () => {
    expect(badContactKinds({ phone: "123", whatsapp: "", messenger: "https://m.me/ok" })).toEqual([
      "phone",
    ]);
    expect(badContactKinds({})).toEqual([]);
  });
  it("counts a contact only when it has something in it", () => {
    expect(hasContact({})).toBe(false);
    expect(hasContact({ phone: "  ", whatsapp: "" })).toBe(false);
    expect(hasContact({ messenger: "https://m.me/x" })).toBe(true);
  });
});

describe("shared contacts schema", () => {
  it("needs at least one contact", () => {
    for (const input of [{}, { phone: "", whatsapp: "  " }]) {
      const result = contacts.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        message: CONTACT_REQUIRED_MESSAGE,
        path: ["phone"],
      });
    }
  });

  it("trims, turns blanks into absent, and keeps what was given", () => {
    expect(contacts.parse({ phone: " +8801712345678 ", whatsapp: "", messenger: "  " })).toEqual({
      phone: "+8801712345678",
      whatsapp: undefined,
      messenger: undefined,
    });
  });

  it("reports a bad value against its own field", () => {
    const result = contacts.safeParse({ phone: "+8801712345678", whatsapp: "wa.me/1" });
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["whatsapp"],
      message: CONTACT_MESSAGES.whatsapp,
    });
  });

  it("refuses a value over the length cap", () => {
    const long = `https://m.me/${"a".repeat(CONTACT_MAX_LENGTH)}`;
    expect(contacts.safeParse({ messenger: long }).success).toBe(false);
  });
});
