import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { fakePushSender, isKnownPushEndpoint, pushSenderFromEnv, webPushSender } from "./push";
import { limits } from "../limits";

const { subtle } = webcrypto;
const enc = new TextEncoder();
const b64u = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
const fromB64u = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
const cat = (...parts: Uint8Array[]) => Buffer.concat(parts);

/** HKDF-SHA256 with the given salt, input key and info. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** The receiving browser: a P-256 key pair and an auth secret, plus RFC 8291 decryption. */
async function makeReceiver() {
  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const publicRaw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const auth = webcrypto.getRandomValues(new Uint8Array(16));
  return {
    p256dh: b64u(publicRaw),
    auth: b64u(auth),
    async decrypt(body: Uint8Array): Promise<string> {
      const salt = body.slice(0, 16);
      const idLen = body[20]!;
      const senderPublic = body.slice(21, 21 + idLen);
      const cipher = body.slice(21 + idLen);
      const sender = await subtle.importKey(
        "raw",
        senderPublic,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
      );
      const secret = new Uint8Array(
        await subtle.deriveBits({ name: "ECDH", public: sender }, pair.privateKey, 256),
      );
      const ikm = await hkdf(
        auth,
        secret,
        cat(enc.encode("WebPush: info\0"), publicRaw, senderPublic),
        32,
      );
      const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
      const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
      const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
      const plain = new Uint8Array(
        await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher),
      );
      // The last record ends with 0x02, then zero padding.
      let end = plain.length;
      while (end > 0 && plain[end - 1] === 0) end -= 1;
      expect(plain[end - 1]).toBe(2);
      return new TextDecoder().decode(plain.slice(0, end - 1));
    },
  };
}

async function makeVapid() {
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  const publicRaw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return {
    publicKey: b64u(publicRaw),
    privateKey: jwk.d!,
    subject: "mailto:unilink@example.com",
    verifyKey: pair.publicKey,
  };
}

const message = { title: "Your post is live", body: "Approved.", url: "/inbox" };

describe("webPushSender", () => {
  it("encrypts the message for the device and signs a VAPID token", async () => {
    const receiver = await makeReceiver();
    const vapid = await makeVapid();
    let seen: { url: string; init: RequestInit } | null = null;
    const sender = webPushSender(vapid, async (url, init) => {
      seen = { url: url as string, init: init! };
      return new Response(null, { status: 201 });
    });
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";

    const result = await sender.send(
      { endpoint, p256dh: receiver.p256dh, auth: receiver.auth },
      message,
    );

    expect(result).toEqual({ ok: true });
    expect(seen!.url).toBe(endpoint);
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(headers.ttl).toBe(String(limits.pushTtlSeconds));
    expect(headers.urgency).toBe("high");

    // The device can decrypt exactly what was sent.
    expect(JSON.parse(await receiver.decrypt(seen!.init.body as Uint8Array))).toEqual(message);

    // RFC 8292: "vapid t=<jwt>, k=<public key>", ES256, audience is the push service origin.
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=(.+)$/.exec(headers.authorization!);
    expect(match).not.toBeNull();
    const [, h, c, sig, k] = match!;
    expect(k).toBe(vapid.publicKey);
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe(vapid.subject);
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(24 * 60 * 60);
    const valid = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      vapid.verifyKey,
      fromB64u(sig!),
      enc.encode(`${h}.${c}`),
    );
    expect(valid).toBe(true);
  });

  it("reports 404 and 410 as gone, other failures as not gone", async () => {
    const receiver = await makeReceiver();
    const vapid = await makeVapid();
    const target = {
      endpoint: "https://fcm.googleapis.com/x",
      p256dh: receiver.p256dh,
      auth: receiver.auth,
    };
    const sendWith = (status: number | "throw") =>
      webPushSender(vapid, async () => {
        if (status === "throw") throw new TypeError("network");
        return new Response(null, { status });
      }).send(target, message);

    expect(await sendWith(410)).toEqual({ ok: false, gone: true });
    expect(await sendWith(404)).toEqual({ ok: false, gone: true });
    expect(await sendWith(500)).toEqual({ ok: false, gone: false });
    expect(await sendWith(429)).toEqual({ ok: false, gone: false });
    expect(await sendWith("throw")).toEqual({ ok: false, gone: false });
  });
});

describe("pushSenderFromEnv", () => {
  it("is null unless all three VAPID values are set", () => {
    expect(pushSenderFromEnv({})).toBeNull();
    expect(pushSenderFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b" })).toBeNull();
    expect(
      pushSenderFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "" }),
    ).toBeNull();
    expect(
      pushSenderFromEnv({
        VAPID_PUBLIC_KEY: "a",
        VAPID_PRIVATE_KEY: "b",
        VAPID_SUBJECT: "mailto:a@b.c",
      }),
    ).not.toBeNull();
  });
});

describe("isKnownPushEndpoint", () => {
  it("accepts the major push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://android.googleapis.com/gcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://push.services.mozilla.com/wpush/v1/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isKnownPushEndpoint(url), url).toBe(true);
    }
  });

  it("rejects other hosts, look-alikes, plain http and junk", () => {
    for (const url of [
      "https://example.com/push",
      "https://evil.test/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.test/x",
      "https://evilpush.apple.com/x",
      "https://notify.windows.com.evil.test/x",
      "http://fcm.googleapis.com/x",
      "not a url",
    ]) {
      expect(isKnownPushEndpoint(url), url).toBe(false);
    }
  });
});

describe("fakePushSender", () => {
  it("records sends and answers ok by default", async () => {
    const fake = fakePushSender();
    const target = { endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a" };
    expect(await fake.send(target, message)).toEqual({ ok: true });
    expect(fake.sent).toEqual([{ target, message }]);
  });
});
