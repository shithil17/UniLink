// Contact formats, shared by the post forms and the screening rules. Contacts are never sent to the
// model and never appear in a feed; this only checks that what was typed has the right shape.

export const contactKinds = ["phone", "whatsapp", "messenger"] as const;
export type ContactKind = (typeof contactKinds)[number];

const PATTERNS: Record<ContactKind, RegExp> = {
  // Bangladeshi mobile in international form.
  phone: /^\+8801[3-9]\d{8}$/,
  whatsapp: /^https:\/\/wa\.me\/\+?\d{7,15}$/,
  messenger: /^https:\/\/(?:m\.me|(?:www\.)?facebook\.com)\/[\w.\-/]+$/,
};

export function isValidContact(kind: ContactKind, value: string): boolean {
  return PATTERNS[kind].test(value);
}

/** The kinds whose value is present but badly formed. Empty or missing values are not checked here. */
export function badContactKinds(
  contacts: Partial<Record<ContactKind, string | undefined>>,
): ContactKind[] {
  return contactKinds.filter((k) => {
    const v = contacts[k];
    return v !== undefined && v !== "" && !isValidContact(k, v);
  });
}
