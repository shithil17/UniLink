// Contact formats, shared by the post forms, the Hono validators and the screening rules. Contacts are
// never sent to the model and never appear in a feed; this only checks that what was typed has the
// right shape. A post needs at least one.

export const contactKinds = ["phone", "whatsapp", "messenger"] as const;
export type ContactKind = (typeof contactKinds)[number];

/** Contacts as typed or stored: each kind is optional, a post needs at least one. */
export type ContactValues = Partial<Record<ContactKind, string | undefined>>;

/** The longest contact value accepted. A phone is 14 characters; the rest are short profile links. */
export const CONTACT_MAX_LENGTH = 200;

const PATTERNS: Record<ContactKind, RegExp> = {
  // Bangladeshi mobile in international form.
  phone: /^\+8801[3-9]\d{8}$/,
  whatsapp: /^https:\/\/wa\.me\/\+?\d{7,15}$/,
  messenger: /^https:\/\/(?:m\.me|(?:www\.)?facebook\.com)\/[\w.\-/]+$/,
};

/** What a badly formed value says, per kind. Shown under its own field. */
export const CONTACT_MESSAGES: Record<ContactKind, string> = {
  phone: "Use a Bangladeshi mobile number like +8801712345678",
  whatsapp: "Use a WhatsApp link like https://wa.me/8801712345678",
  messenger: "Use a Messenger or Facebook link like https://m.me/yourname",
};

export const CONTACT_REQUIRED_MESSAGE = "Add at least one way to reach you";

export const CONTACT_TOO_LONG_MESSAGE = `Keep it under ${CONTACT_MAX_LENGTH} characters`;

export function isValidContact(kind: ContactKind, value: string): boolean {
  return value.length <= CONTACT_MAX_LENGTH && PATTERNS[kind].test(value);
}

/** The kinds whose value is present but badly formed. Empty or missing values are not checked here. */
export function badContactKinds(contacts: ContactValues): ContactKind[] {
  return contactKinds.filter((k) => {
    const v = contacts[k];
    return v !== undefined && v !== "" && !isValidContact(k, v);
  });
}

/** True when at least one contact has a value (blank or whitespace-only does not count). */
export function hasContact(contacts: ContactValues): boolean {
  return contactKinds.some((k) => (contacts[k] ?? "").trim() !== "");
}
