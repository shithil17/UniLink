// Worker secrets that are optional: with any of the three VAPID values unset, web push is off.
// Set with `wrangler secret put` (see `vp run push:keys`) and in the git-ignored `.dev.vars`.
//
// SCREEN_FORCE_REVIEW is test-only: the exact value "1" holds every post that passes the screening rules
// for a moderator, so the review queue can be exercised before a real model exists. Leave it unset
// everywhere else, production above all.
interface Env {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  SCREEN_FORCE_REVIEW?: string;
}
declare namespace Cloudflare {
  interface Env {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    SCREEN_FORCE_REVIEW?: string;
  }
}
