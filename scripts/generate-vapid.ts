import { webcrypto } from "node:crypto";
// Prints a fresh VAPID key pair for web push and the commands that store it as Worker secrets.
// Run with `vp run push:keys`. Nothing is written to disk: copy the values yourself.

const { subtle } = webcrypto;

const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const publicKey = Buffer.from(await subtle.exportKey("raw", pair.publicKey)).toString("base64url");
const { d: privateKey } = await subtle.exportKey("jwk", pair.privateKey);

console.log(`Public key (also given to browsers):\n${publicKey}\n`);
console.log(`Private key (secret, never commit it):\n${privateKey}\n`);
console.log(
  "Set them on each environment (wrangler asks for the value; add --env staging or --env production):",
);
console.log("  wrangler secret put VAPID_PUBLIC_KEY");
console.log("  wrangler secret put VAPID_PRIVATE_KEY");
console.log("  wrangler secret put VAPID_SUBJECT   # a contact, e.g. mailto:you@example.com");
console.log("\nFor local dev, add the same three names to .dev.vars (git-ignored).");
console.log(
  "Use a different key pair per environment. Changing a key invalidates existing subscriptions.",
);
