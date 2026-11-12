import {
  contactKinds,
  isValidContact,
  type ContactKind,
  type ContactValues,
} from "../../shared/contact";

/** One way to reach a poster, as the detail view draws it: a labelled link that opens the right app. */
export type ContactAction = {
  kind: ContactKind;
  /** The button's words. */
  label: string;
  /** What is shown next to it, so the person can see what they are about to open. */
  display: string;
  href: string;
};

const LABELS: Record<ContactKind, string> = {
  phone: "Call",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
};

/**
 * The action links for a post's contacts: `tel:` for a phone, the `wa.me` link for WhatsApp, the `m.me`
 * or `facebook.com` link for Messenger. Only a value that passes the shared format check becomes a
 * link, so a stored value that somehow isn't one never turns into an `href` (no `javascript:` links).
 * Kinds come out in a fixed order and a missing or blank contact is left out.
 */
export function contactActions(contacts: ContactValues): ContactAction[] {
  const actions: ContactAction[] = [];
  for (const kind of contactKinds) {
    const value = contacts[kind]?.trim();
    if (!value || !isValidContact(kind, value)) continue;
    actions.push({
      kind,
      label: LABELS[kind],
      display: kind === "phone" ? value : value.replace(/^https:\/\/(?:www\.)?/, ""),
      href: kind === "phone" ? `tel:${value}` : value,
    });
  }
  return actions;
}
