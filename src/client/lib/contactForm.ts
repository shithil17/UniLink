import { isValidContact } from "../../shared/contact";

// The number field of a post form: a fixed "+880" in front, ten digits typed by the student, and two
// toggles that say whether the number takes calls and WhatsApp. This turns that into the `phone` and
// `whatsapp` strings the shared schema and the server already know, and back again for an edit.

/** Bangladesh's country code. It is shown in front of the field, never typed. */
export const BD_PREFIX = "+880";
const WA_BASE = "https://wa.me/880";
/** A local mobile number has ten digits after the code: 1712345678. */
const LOCAL_LENGTH = 10;

/** What the number part of a contact form holds. */
export type ContactNumbers = {
  /** The local digits as typed, without a leading zero or the country code. */
  digits: string;
  /** The number takes calls (stored as `phone`). */
  calls: boolean;
  /** The number takes WhatsApp (stored as `whatsapp`). Ignored while `otherWhatsapp` is set. */
  whatsapp: boolean;
  /** A separate WhatsApp number, for a person whose WhatsApp is not their calling number. Null for one number. */
  otherWhatsapp: string | null;
  /**
   * A stored WhatsApp link for a number outside Bangladesh (the schema allows any 7 to 15 digit
   * wa.me link), kept exactly as stored until the poster replaces it. Never shown under "+880" and
   * never rewritten when the phone changes. Null when there is none.
   */
  foreignWhatsapp: string | null;
};

export const emptyNumbers = (): ContactNumbers => ({
  digits: "",
  calls: true,
  whatsapp: true,
  otherWhatsapp: null,
  foreignWhatsapp: null,
});

/** Strips the country code or the trunk zero off whatever digits were typed or pasted. */
function localDigits(input: string): string {
  const all = input.replace(/\D/g, "");
  if (all.startsWith("880")) return all.slice(3);
  if (all.startsWith("0")) return all.slice(1);
  return all;
}

/**
 * What the field holds after a keystroke or a paste: "01712345678", "8801712345678", "+8801712345678"
 * and "0171-234 5678" all become "1712345678". Anything past ten digits is dropped.
 */
export function normalizeLocalDigits(input: string): string {
  return localDigits(input).slice(0, LOCAL_LENGTH);
}

const isLocalNumber = (digits: string) => isValidContact("phone", BD_PREFIX + digits);

/** "1712345678" as "+880 1712-345678", for showing next to a button. Anything else comes back unchanged. */
export function formatBdNumber(digits: string): string {
  return isLocalNumber(digits) ? `${BD_PREFIX} ${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

const phoneOf = (digits: string, on: boolean) => (on && digits !== "" ? BD_PREFIX + digits : "");

// A number that is not complete yet must fail the WhatsApp format rather than slip through as a
// short but valid-looking link, so it is stored as the bare "+880..." text, which the schema refuses.
const whatsappOf = (digits: string, on: boolean) => {
  if (!on || digits === "") return "";
  return isLocalNumber(digits) ? WA_BASE + digits : BD_PREFIX + digits;
};

/** The `phone` and `whatsapp` form values for the typed number and toggles; empty strings mean absent. */
export function contactValuesFromNumbers(n: ContactNumbers): { phone: string; whatsapp: string } {
  if (n.foreignWhatsapp !== null) {
    return { phone: phoneOf(n.digits, true), whatsapp: n.foreignWhatsapp };
  }
  if (n.otherWhatsapp !== null) {
    return { phone: phoneOf(n.digits, true), whatsapp: whatsappOf(n.otherWhatsapp, true) };
  }
  return { phone: phoneOf(n.digits, n.calls), whatsapp: whatsappOf(n.digits, n.whatsapp) };
}

/** A stored WhatsApp link's number with its country code, "+14155550123", for showing it as it is. */
export const foreignWhatsappLabel = (stored: string) => "+" + stored.replace(/\D/g, "");

// A country code never starts with 0, and 880 is Bangladesh's.
const isForeignWhatsapp = (stored: string) => {
  const all = stored.replace(/^https?:\/\/wa\.me\//i, "").replace(/\D/g, "");
  return all !== "" && !all.startsWith("880") && !all.startsWith("0");
};

/**
 * The number state for stored `phone` and `whatsapp` values (a wa.me link with or without "+"). The
 * same number in both turns both toggles on; only one turns on its toggle; two different numbers
 * become the first with Calls plus a separate WhatsApp number, so neither is lost. A WhatsApp link
 * for a foreign number is kept as stored, beside the phone. Nothing stored gives the default of both
 * toggles on.
 */
export function numbersFromContacts(c: { phone?: string; whatsapp?: string }): ContactNumbers {
  const phone = localDigits(c.phone ?? "");
  if (c.whatsapp && isForeignWhatsapp(c.whatsapp)) {
    return {
      digits: phone,
      calls: true,
      whatsapp: false,
      otherWhatsapp: null,
      foreignWhatsapp: c.whatsapp,
    };
  }
  const whatsapp = localDigits((c.whatsapp ?? "").replace(/^https?:\/\/wa\.me\//i, ""));
  if (phone === "" && whatsapp === "") return emptyNumbers();
  if (whatsapp === "")
    return {
      digits: phone,
      calls: true,
      whatsapp: false,
      otherWhatsapp: null,
      foreignWhatsapp: null,
    };
  if (phone === "")
    return {
      digits: whatsapp,
      calls: false,
      whatsapp: true,
      otherWhatsapp: null,
      foreignWhatsapp: null,
    };
  if (phone === whatsapp)
    return {
      digits: phone,
      calls: true,
      whatsapp: true,
      otherWhatsapp: null,
      foreignWhatsapp: null,
    };
  return {
    digits: phone,
    calls: true,
    whatsapp: false,
    otherWhatsapp: whatsapp,
    foreignWhatsapp: null,
  };
}
