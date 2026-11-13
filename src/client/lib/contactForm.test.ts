import { describe, expect, it } from "vite-plus/test";
import {
  contactValuesFromNumbers,
  emptyNumbers,
  foreignWhatsappLabel,
  formatBdNumber,
  normalizeLocalDigits,
  numbersFromContacts,
} from "./contactForm";

describe("normalizeLocalDigits", () => {
  it.each([
    ["1712345678", "1712345678"],
    ["01712345678", "1712345678"],
    ["8801712345678", "1712345678"],
    ["+8801712345678", "1712345678"],
    ["+880 1712-345 678", "1712345678"],
    ["0171-234 5678", "1712345678"],
    ["", ""],
    ["0", ""],
    ["880", ""],
    ["171", "171"],
    ["17123456789999", "1712345678"],
  ])("reads %j as %j", (typed, digits) => {
    expect(normalizeLocalDigits(typed)).toBe(digits);
  });
});

describe("contactValuesFromNumbers", () => {
  const n = (over: Partial<ReturnType<typeof emptyNumbers>>) => ({
    ...emptyNumbers(),
    digits: "1712345678",
    ...over,
  });

  it("stores calls as +880... and WhatsApp as a wa.me link", () => {
    expect(contactValuesFromNumbers(n({}))).toEqual({
      phone: "+8801712345678",
      whatsapp: "https://wa.me/8801712345678",
    });
  });

  it("leaves out the kind that is switched off", () => {
    expect(contactValuesFromNumbers(n({ calls: false }))).toEqual({
      phone: "",
      whatsapp: "https://wa.me/8801712345678",
    });
    expect(contactValuesFromNumbers(n({ whatsapp: false }))).toEqual({
      phone: "+8801712345678",
      whatsapp: "",
    });
  });

  it("stores nothing for an empty number", () => {
    expect(contactValuesFromNumbers(emptyNumbers())).toEqual({ phone: "", whatsapp: "" });
  });

  it("keeps an unfinished number from passing as a short WhatsApp link", () => {
    expect(contactValuesFromNumbers(n({ digits: "1712", calls: false }))).toEqual({
      phone: "",
      whatsapp: "+8801712",
    });
  });

  it("gives the WhatsApp number its own value when it differs", () => {
    expect(contactValuesFromNumbers(n({ otherWhatsapp: "1912345678" }))).toEqual({
      phone: "+8801712345678",
      whatsapp: "https://wa.me/8801912345678",
    });
    expect(contactValuesFromNumbers(n({ otherWhatsapp: "" }))).toEqual({
      phone: "+8801712345678",
      whatsapp: "",
    });
  });
});

describe("numbersFromContacts", () => {
  it("opens with both toggles on for a new post", () => {
    expect(numbersFromContacts({})).toEqual(emptyNumbers());
  });

  it("shows one number with both toggles when both are the same, with or without a plus", () => {
    const both = {
      digits: "1712345678",
      calls: true,
      whatsapp: true,
      otherWhatsapp: null,
      foreignWhatsapp: null,
    };
    expect(
      numbersFromContacts({ phone: "+8801712345678", whatsapp: "https://wa.me/8801712345678" }),
    ).toEqual(both);
    expect(
      numbersFromContacts({ phone: "+8801712345678", whatsapp: "https://wa.me/+8801712345678" }),
    ).toEqual(both);
  });

  it("turns on only the toggle that has a value", () => {
    expect(numbersFromContacts({ phone: "+8801712345678" })).toMatchObject({
      digits: "1712345678",
      calls: true,
      whatsapp: false,
    });
    expect(numbersFromContacts({ whatsapp: "https://wa.me/8801712345678" })).toMatchObject({
      digits: "1712345678",
      calls: false,
      whatsapp: true,
    });
  });

  it("keeps both numbers when they differ", () => {
    const stored = { phone: "+8801712345678", whatsapp: "https://wa.me/8801912345678" };
    const numbers = numbersFromContacts(stored);
    expect(numbers).toMatchObject({ digits: "1712345678", otherWhatsapp: "1912345678" });
    expect(contactValuesFromNumbers(numbers)).toEqual(stored);
  });

  it("round-trips every kind of stored value", () => {
    for (const stored of [
      { phone: "+8801712345678", whatsapp: "https://wa.me/8801712345678" },
      { phone: "+8801712345678", whatsapp: "" },
      { phone: "", whatsapp: "https://wa.me/8801712345678" },
    ]) {
      expect(contactValuesFromNumbers(numbersFromContacts(stored))).toEqual(stored);
    }
  });

  it("keeps a foreign WhatsApp link as stored instead of reading it as a +880 number", () => {
    for (const whatsapp of ["https://wa.me/14155550123", "https://wa.me/+14155550123"]) {
      const stored = { phone: "+8801712345678", whatsapp };
      const numbers = numbersFromContacts(stored);
      expect(numbers).toMatchObject({ digits: "1712345678", foreignWhatsapp: whatsapp });
      expect(contactValuesFromNumbers(numbers)).toEqual(stored);
      // Changing the phone leaves the WhatsApp link exactly as it was.
      expect(contactValuesFromNumbers({ ...numbers, digits: "1812345678" })).toEqual({
        phone: "+8801812345678",
        whatsapp,
      });
    }
  });

  it("keeps a foreign WhatsApp link that has no phone beside it", () => {
    const stored = { phone: "", whatsapp: "https://wa.me/14155550123" };
    expect(contactValuesFromNumbers(numbersFromContacts(stored))).toEqual(stored);
  });

  it("does not take a Bangladeshi WhatsApp link, with or without the trunk zero, for a foreign one", () => {
    for (const whatsapp of ["https://wa.me/8801712345678", "https://wa.me/01712345678"]) {
      expect(numbersFromContacts({ whatsapp }).foreignWhatsapp).toBeNull();
    }
  });

  it("reads a wa.me link of a 10-digit local mobile without 880 as Bangladeshi", () => {
    expect(numbersFromContacts({ whatsapp: "https://wa.me/1712345678" })).toMatchObject({
      digits: "1712345678",
      calls: false,
      whatsapp: true,
      foreignWhatsapp: null,
    });
  });

  it("still treats an 11-digit +1 number, or a 10-digit one outside the mobile shape, as foreign", () => {
    for (const whatsapp of ["https://wa.me/14155550123", "https://wa.me/1212345678"]) {
      expect(numbersFromContacts({ whatsapp }).foreignWhatsapp).toBe(whatsapp);
    }
  });
});

describe("foreignWhatsappLabel", () => {
  it("shows the stored number with its plus", () => {
    expect(foreignWhatsappLabel("https://wa.me/14155550123")).toBe("+14155550123");
    expect(foreignWhatsappLabel("https://wa.me/+14155550123")).toBe("+14155550123");
  });
});

describe("formatBdNumber", () => {
  it("groups a full number and leaves anything else alone", () => {
    expect(formatBdNumber("1712345678")).toBe("+880 1712-345678");
    expect(formatBdNumber("171")).toBe("171");
  });
});
