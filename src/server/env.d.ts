// Worker secrets that are optional: with any of the three VAPID values unset, web push is off.
// Set with `wrangler secret put` (see `vp run push:keys`) and in the git-ignored `.dev.vars`.
interface Env {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
declare namespace Cloudflare {
  interface Env {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  }
}
