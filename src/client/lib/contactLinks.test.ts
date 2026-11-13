import { describe, expect, it } from "vite-plus/test";
import { contactActions } from "./contactLinks";

describe("contactActions", () => {
  it("turns each contact into the link that opens the right app, in a fixed order", () => {
    expect(
      contactActions({
        messenger: "https://m.me/some.one",
        phone: "+8801712345678",
        whatsapp: "https://wa.me/8801712345678",
      }),
    ).toEqual([
      { kind: "phone", label: "Call", display: "+880 1712-345678", href: "tel:+8801712345678" },
      {
        kind: "whatsapp",
        label: "WhatsApp",
        display: "+880 1712-345678",
        href: "https://wa.me/8801712345678",
      },
      {
        kind: "messenger",
        label: "Messenger",
        display: "m.me/some.one",
        href: "https://m.me/some.one",
      },
    ]);
  });

  it("shows a wa.me link with a plus the same way, and a foreign number as stored", () => {
    expect(contactActions({ whatsapp: "https://wa.me/+8801712345678" })).toMatchObject([
      { display: "+880 1712-345678", href: "https://wa.me/+8801712345678" },
    ]);
    expect(contactActions({ whatsapp: "https://wa.me/14155550123" })).toMatchObject([
      { display: "wa.me/14155550123" },
    ]);
  });

  it("uses the facebook link as it is", () => {
    expect(contactActions({ messenger: "https://www.facebook.com/some.one" })).toMatchObject([
      { href: "https://www.facebook.com/some.one", display: "facebook.com/some.one" },
    ]);
  });

  it("leaves out missing and blank contacts", () => {
    expect(contactActions({})).toEqual([]);
    expect(contactActions({ phone: "", whatsapp: "  ", messenger: undefined })).toEqual([]);
  });

  it("never makes a link from a value that is not a valid contact", () => {
    expect(
      contactActions({
        phone: "javascript:alert(1)",
        whatsapp: "http://wa.me/8801712345678",
        messenger: "https://evil.com/m.me/x",
      }),
    ).toEqual([]);
  });
});
