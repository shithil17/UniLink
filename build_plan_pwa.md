# NSU Student Companion App: Build Plan (PWA)

This is the build plan for the unofficial, student-run NSU CSE companion PWA (CSE327, about 8 weeks). It turns [`plan_pwa.md`](plan_pwa.md) into ordered phases. Each phase has one owner, a checklist and a test gate. The doc is self-contained: every rule needed to build a feature is locked inside the phase that builds it, so nobody has to switch between docs while coding. `plan_pwa.md` stays as background (product reasoning, the full risk table, the course outcome mapping). It is not a second source of truth. If a rule changes, change it here and add a one-line note. This doc does not hold the SRS, UML, ToS or the manual test cases. Those are C's and D's deliverables and are listed in Cross-references.

---

## Status

**Restyle note (2026-10-24):** The Pocket Planner restyle is done; it supersedes the visual locks of Phase 4b. The non-visual locks stay.

**Status (2026-11-12):** Phase 0 gate passed (iOS install pending). Phase 1 automated gate passed; its manual checks (installed-app theme persistence, D contrast check) are pending. Phase 2 auth tests pass locally (2026-10-18); the CI run and the staging phone check (sign up, log in, log out, seeded admin forced to change password) are pending. Phase 3 automated checks pass (2026-10-19); the manual gate (airplane-mode offline screen on Android and iOS, update prompt after a staging deploy, no `/api` response from the service worker cache in DevTools) is pending. Phase 4b automated gate passed (2026-10-20); the manual checks (every screen at 390px and 1440px on all five palettes, D contrast check) are pending; `DESIGN.md` is written. The Pocket Planner restyle replaced the Phase 4b visual language on 2026-10-24, and `DESIGN.md` now records the built system. Phase 5 gate passed (2026-10-20): inbox tests pass and `notify()` takes `db` first, like `audit()`. Web push is in; its staging phone check is pending. Phase 6 automated gate passed (2026-10-20): grading and attempt tests pass; the manual check (a seeded student's CGPA on staging matches D's hand calculation) is pending, and `data/faculty/` holds the ECE faculty from the public department listing plus partial lists for eight other departments (see `docs/faculty-sources.md`). Phase 7 automated gate passed (2026-10-20): mod tests pass; the staging check (an admin reverses a ban and a soft delete and both reversals appear in the audit log) is pending, and needs a content type with `deleted_at` registered in `softDeleteTargets` before a soft delete can happen on staging. Report reasons are not screened until `screen()` lands (Phase 8). Phase 8 automated gate passed (2026-10-20): moderation tests pass; the staging check (forced-review post reaches the mod queue, a mod approves it, the author gets an inbox message) waits for the first post type to register in `moderatedPostTypes` and call `submitPost()`. Phase 9 automated gate passed (2026-10-20): routine tests pass; the manual check (entries show on Home on the right weekday and in time order, on a phone) is pending, and D still confirms the NSU day letters (S M T W R F A). Phase 9b automated gate passed (2026-11-05): planner and target tests pass; the manual check (D's two hand-calculated scenarios match the planner on a phone) is pending. C's and D's planner docs are written. Phase 10 automated gate passed (2026-11-12): resource and link rule tests pass, `cron.ts` runs the two resource purges daily at 03:00 Dhaka, and resource requests and links are the first registered moderated post types. The staging check (request → notification → submit → accept between two seeded students, with the link hidden from the second one's view) is pending. C's and D's resource docs and the legal drafts are written. Phase 11 automated gate passed (2026-11-12): contact and ride tests pass, and the shared post kit (contacts, contact reveal, expiry, report, status note, author delete, purge rule) is ready for lost and found and marketplace. The manual phone check (post a recurring ride, filter by weekday, reveal the contact, WhatsApp and dialer links open the right app) is pending, and migrations `0019_rides` and `0020_ride_areas` must be applied on staging and production before deploy. Changes from `plan_pwa.md`:

- The two cut orders that disagreed are now one locked order (see Suggested Build Order).
- Course "ticks" are graded attempts, so attempts are the only source of truth for done courses, credits and CGPA (Phase 4).
- The inbox moves to the start of Dev A's Sprint 2, because held-post notifications (Phase 8) write to it.
- Signup rate limits and the new-account cooldown move from Sprint 4 to Phase 2, because they are the main defence while there is no email verification. They use one shared `rateLimit()` helper.
- Week 0 now also proves D1 reads, an API test harness and the deploy pipeline.
- All limits live in one config file, and all times use Asia/Dhaka.
- (2026-10-19) Any course can be marked waived: it counts as done and earns credits but never affects CGPA (Phase 4, Phase 6).
- (2026-10-19) The course map covers every undergraduate program with a course map, picked by the program code in the student ID. Students add their own elective courses (code, title, credits), may go over the degree total, and can exclude extra courses from the transcript (Phase 4).
- (2026-10-20) New Phase 4b: the Quiet Utility design language reorganizes Phase 1's four palettes into shared roles and restyles every existing screen. The app now serves all NSU undergraduates, with CSE-only extras (faculty profiles, supervisor finder). (2026-10-23) Its visual locks are superseded by [`build_plan_pocket_planner.md`](build_plan_pocket_planner.md).
- (2026-10-19) Lost-and-found posts and marketplace listings can carry up to 3 photos: WebP made in the browser, checked and screened by the server, stored in R2 (post photos kit, Phase 12). Photos in the "ID or card" category always go to a mod first. Authors can delete their own posts (Phase 11).
- (2026-10-20) Faculty now covers every NSU department, each with a department, optional initials, an NSU page and a hidden flag; students search and filter the picker by name, initials and department; mods manage faculty (add, edit, hide, show again) in the panel.
- (2026-10-20) Mods manage curriculum courses in the panel (`/mod/courses`): add, edit (including prerequisites as text, such as `CSE215 and (MAT120 or MAT125)`) and hide or show again with a reason, never delete (`courses.hidden`, migration 0011). Hidden courses leave students' maps unless the student already has an attempt on them. Re-importing a version still replaces all its courses, edits included, and the import screen warns. A slot with alternatives shows all its codes joined with "/" until the student takes one.
- (2026-10-21) Elective trails and open electives: a curriculum can list its specialized elective trails (CSE: six trails, at least two courses from one trail). Students fill trail elective slots by picking from the trail list, see their trail progress on the map, and get title and credits filled in from a course code for open electives. CSE498 Internship/Co-op is on the CSE map as a non-credit course (Phase 4).
- (2026-11-12) Rides, lost and found and marketplace now come straight after resources (renumbered 11, 12, 13), then Clef auto-moderation (14), hardening (15) and delivery (16). Faculty research profiles and the AI supervisor finder are optional phases O1 and O2 at the bottom and may never ship; the finder gate moved from Clef to O2. The faculty directory is unchanged. Marketplace moves to Dev A, after Clef.
- (2026-11-12, later) Clef auto-moderation is optional phase O3 at the bottom too. The release ships with the rules step, the stub model step and the human review queue: posts publish after the rules, posts with photos always wait for a mod, and reports cover the rest. Hardening and delivery are now 14 and 15. Lost and found moves to Dev A and marketplace to Dev B.
- (2026-11-02) New Phase 9b: a Planner view in Courses. Students set a target CGPA (saved to the account), try mock grades on past and future courses (kept in the browser only), and get advice that prefers doing better in remaining courses and suggests the fewest retakes only when the target needs them. It runs before Phase 10.
- (2026-11-12) The resource link rule is no longer a five-host allowlist: any public https site is accepted, and a short list of link shorteners, IP addresses and private names is refused (Phase 10). The open decision on the list of sharing hosts is settled.
- (2026-11-12) Links inside post text follow the same rule as resource links: any safe https link passes the rules step, and a shortener, `http`, an IP address, a private name or a login or port in the address is rejected as scam or spam (Phase 8). The URL allowlist is gone.
- (2026-11-12) A report on a request or link in the review queue has a Remove action: a reason, a confirmation, then `softDelete()` through `POST /api/mod/reports/:id/remove`, which also closes the open reports on it (Phases 7 and 10). An admin can reverse the removal from the audit log.
- (2026-11-12) When a mod removes content, `softDelete()` tells its author through `notify()` (type `content_removed`, payload `{ kind, reason }`; inbox plus web push, the push generic). The inbox row names the kind and shows the mod's reason, and opens Materials. No notice when the author removed it themself, on a reversal or for the cron purges (Phases 5, 7 and 10).
- (2026-11-12) A banned user who logs in with the right password is told why. `users` gets a nullable `ban_reason` (migration `0018_ban_reason`), set by `banUser()` from the mod's reason, cleared by `unbanUser()` and by an admin reversing a ban, and put back when an admin reverses an unban. The 403 `account_banned` body becomes `{ error, message, reason, contact }` (shared `accountBannedResponse`), still sent only after the password check. `contact` is the new Worker var `ADMIN_CONTACT_EMAIL` (empty in `wrangler.jsonc`, set per environment). The login screen shows a toast that stays until dismissed, with the reason and a mailto link, and the same text inline. The migration must be applied on staging and production (`vp run db:migrate:staging`, `vp run db:migrate:prod`) and `ADMIN_CONTACT_EMAIL` set in each env's `vars` before deploy (Phases 2 and 7).
- (2026-11-12) New Phase 13b: a Help screen and a Contact admins flow. Signed-in students leave their own email and an issue, every admin gets it in the inbox, and admins reply in an in-app thread, optionally with their own email. No outbound email, and no public form (logged-out and banned users keep the `ADMIN_CONTACT_EMAIL` mailto). It runs after Phase 12 on Dev A's track.
- (2026-11-12) New Phase 11b: a Map view in Rides with ride counts per area as pins. It uses MapLibre GL JS with our own style built from the theme tokens, OpenFreeMap tiles first, then a self-hosted Dhaka `.pmtiles` extract on R2. It is area-level only, with no geocoding and no paid service. Exact pickup pins are parked and would sit behind the contact reveal.
- (2026-11-12) Rides are filtered by area, not free text: each ride has a required pickup and destination area from a seeded Dhaka list (`areas`, migration `0020_ride_areas`) plus optional screened landmarks; mods add, rename, nest and hide areas, with audit rows (Phase 11).
- (2026-11-12) Resource requests also reach students who did not get the publish-time notification. The Materials screen has a Help others tab listing open requests for any course the student has recorded (any faculty) and faculty-only requests for a faculty member they had, with same-faculty ones first and tagged. The requester sees whether each link's sender took the same faculty. Notifications and the purge rules are unchanged.

---

## Principles (locked)

**Architecture**

- One repo, one Cloudflare Worker, one D1 database and one private R2 bucket (post photos) per environment. The Worker serves both `/api/*` (Hono) and the built PWA (Workers Static Assets), so everything is on one origin: no CORS and no second host.
- Request and response shapes are Zod schemas in `src/shared/schemas/`. The client forms (React Hook Form) and the Hono validators import the same schema, so nobody writes a shape twice.
- Data access goes through the repository layer (`src/server/repos/`). Route handlers never build SQL.
- Every external service (OpenAlex, ORCID, Crossref, DeepSeek, Clef) sits behind a small interface in `src/server/adapters/` with a fake next to it. Tests use the fakes and never touch the network.
- All limits, caps, cooldowns, expiry periods and thresholds live in one place, `src/server/limits.ts`. Feature code never contains a literal like `10` or `60 days`.
- Time: instants are stored as UTC epoch milliseconds. Weekdays and times of day (routine entries, recurring rides) are stored as Asia/Dhaka local values. "Today", "expired" and cron windows are worked out in Asia/Dhaka. Cron Triggers fire in UTC, so convert.
- Data is always fetched live. The service worker caches only the app shell. `ceiling:` there is no offline editing and no sync. Revisit only if the survey shows a real need.

**Safety, privacy and moderation**

- Every user-written post (resource request or submission, ride, lost-and-found post, marketplace listing) calls `screen()` on create **and** on edit. There are no exceptions and no per-feature shortcuts.
- Mods only soft-delete. Hard deletion happens only through the expiry cron. Every mod action and every automatic action writes an audit row (actor, target, before-snapshot, reason). Admins reverse an action from the snapshot, and the reversal is logged too.
- The student ID is never shown publicly. Only the username is. Mods see the ID only inside the ID-conflict tool. Mods and admins can never read attempts, CGPA or routine data.
- No username or student ID is ever sent to DeepSeek or Clef. Supervisor finder text is never stored.
- AI output is never shown as free text. Model JSON is validated with Zod, faculty IDs are checked against the database, and the reply text is built by the server. The model never browses web pages.
- Rate limits and caps are checked on the server **before** the expensive or sensitive action, using one `rateLimit()` helper backed by D1.
- Contact details (phone, WhatsApp, Messenger) are never part of feed responses. They come only from a separate reveal endpoint that needs a login and is rate-limited.

**UI**

- Mobile-first and responsive. The same screens work on a phone and on desktop.
- Components use theme token classes only (`bg-app`, `text-ink`, `border-line`, `bg-surface`, …). No hex values, no `bg-white`, no Tailwind palette colors outside `index.css`.
- Every screen follows the Pocket Planner language ([`build_plan_pocket_planner.md`](build_plan_pocket_planner.md), which supersedes the visual locks of Phase 4b; `DESIGN.md` records the built system): neutral grounds, flat borderless surfaces with hairline-separated rows, one accent per palette plus six course hues used only for course data, a floating tab bar, soft rounded shapes, Figtree with Noto Sans Bengali for Bangla, the shared state marks, shadow only on floating layers, and no gradients or glass.
- Build forms from the shadcn/ui form components + React Hook Form + the shared Zod schema.
- Feedback has one place per kind (decided 2026-10-18). **Toast** (sonner): every message about an action or a failed load ("Saved", "Report sent", "Copied", a server error, rate limit hit, network error, "The faculty list did not load"). No inline message boxes (revised 2026-10-20). Error toasts stay up longer (`ERROR_TOAST_MS` in `src/client/lib/toast.ts`). **Inline field errors** only for per-field validation (the Zod schema, or a server error tied to one field such as `code_taken`). **`StatusNote`** for moderation states, because they persist. **Inbox** for anything the user must see later. Toasts never contain contact details, student IDs or AI text.

**Process**

- Vite+ is the entry point (`vp`). Custom scripts always go through `vp run <script>`, never `vp <script>`. Pin the Vite+ and Node versions and upgrade on purpose.
- Feature branches, pull requests, protected `main`. Every pull request is reviewed by the other developer.
- **Core feature freeze at the end of Week 6.** Only lost and found and marketplace (Phases 12 and 13) may land in Week 7. Week 8 is for hardening, documents and the demo.
- Intentional limits are tagged `ceiling:` with the reason and what would justify revisiting them.

**Definition of done (every phase)**

1. Works on staging, on a phone-sized screen and on desktop.
2. Has unit or API tests as appropriate, and `vp check` and `vp test` pass in CI.
3. Its pull request was reviewed by the other developer.
4. Each requirement ID it covers has at least one manual test case (D).
5. The relevant SRS section and diagram match what was built (C).

### How to use this doc

1. Pick the next unchecked phase on your track in **Suggested Build Order**, and check that the phases it depends on have passed their gates.
2. Read the phase's **Design decisions (locked in)** before writing code. Do not reopen them without new evidence. If one must change, edit it in place with a dated note.
3. Build the smallest correct version. Prefer the shared helper (`screen()`, `rateLimit()`, `notify()`, `audit()`, the post kit) over per-feature copies.
4. Leave at least one runnable test that fails if the logic breaks. Tick the boxes (`[x]`) as you go, and pass the Test Gate before you start the next phase.
5. Update the **Status** line (with the date) when a phase ships. When an **Open decision** is settled, move it into the locked block of the phase that needed it.

---

## Tech Stack Decisions

| Role            | Library / Tool                                                                                                       | Why                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Toolchain       | **Vite+** (`vp`): Vite, Vitest, Oxlint, Oxfmt, Rolldown, task runner                                                 | One dependency and one config for dev, build, lint, format and test                 |
| Package manager | pnpm, one `package.json`, no workspaces                                                                              | Simple. Vite+ drives it (`vp install`, `vp add`)                                    |
| App             | React + TypeScript, Tailwind CSS v4, shadcn/ui                                                                       | Team knows React. shadcn gives accessible parts that follow the theme tokens        |
| PWA             | `vite-plugin-pwa` **≥ 1.3.0** (Vite 8 support)                                                                       | Manifest + service worker without hand-written Workbox config                       |
| Routing         | TanStack Router (file-based, typed links, Zod search params)                                                         | Filters become shareable URLs that work with the back button. Loaders prefetch data |
| Server state    | TanStack Query                                                                                                       | Caching, loading and error states, invalidation after changes                       |
| Forms           | shadcn form + React Hook Form + Zod                                                                                  | shadcn default. Shares schemas with the API                                         |
| Theming         | Tailwind v4 `@theme` tokens + `:root[data-theme]` overrides, `ThemeProvider`, picker ported from the mock site       | Colors only. shadcn variables alias the tokens                                      |
| API             | Hono on Cloudflare Workers, Zod validation                                                                           | Small, typed, built for Workers                                                     |
| Hosting         | Workers Static Assets via `@cloudflare/vite-plugin`                                                                  | One deploy ships the API and the PWA together, so they also roll back together      |
| Database        | Cloudflare D1 (SQLite)                                                                                               | Same platform as the Worker, free tier                                              |
| Object storage  | Cloudflare R2, private bucket bound to the Worker (`POST_PHOTOS`). Lost-and-found and marketplace photos, WebP only  | Same platform, no egress fees, free tier far above expected use                     |
| ORM             | Drizzle (`schema.ts`, `drizzle-kit` migrations)                                                                      | Typed queries, versioned migrations                                                 |
| Auth            | Own `sessions` table, hashed tokens, HttpOnly + Secure + SameSite=Lax cookie, WebCrypto PBKDF2                       | No third-party auth. Works on Workers                                               |
| Scheduled jobs  | Cloudflare Cron Triggers (same Worker)                                                                               | No extra service                                                                    |
| AI text         | DeepSeek V4.1 Flash (`deepseek-flash`), key as a Worker secret. Only used by the optional phases O1 and O2           | Cheap. Context caching suits the fixed faculty block                                |
| AI decisions    | Optional (Phase O3): Clef-flash (`@cf/cloudflare/clef-flash`) via the Workers AI binding, Clef as the fallback model | Same account, no key, very cheap screening                                          |
| Research data   | OpenAlex (primary), ORCID public API (cross-check), Crossref (optional). Google Scholar is link-out only             | Structured JSON. No scraping                                                        |
| CI              | GitHub Actions with `voidzero-dev/setup-vp`                                                                          | Official Vite+ setup                                                                |

> **Why Vite+ while it is in beta (0.2.x)?** One config replaces the separate ESLint, Prettier, Vitest and lint-staged setups, and it sits on top of plain Vite, so the escape hatch is cheap. Phase 0 proves the full stack under `vp`. If any piece conflicts, fall back to plain Vite + Vitest + pnpm and record that decision in Phase 0.

### Vite+ usage

| Task                       | Command                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Install / add packages     | `vp install`, `vp add <pkg>`                                                         |
| Dev server                 | `vp dev`                                                                             |
| Format + lint + type check | `vp check` (`vp check --fix` to apply fixes)                                         |
| Unit and API tests         | `vp test` (optionally `vp test <path-filter>`)                                       |
| Production build           | `vp build`                                                                           |
| Project scripts            | `vp run <script>` (`db:migrate:*`, `deploy:*`, `seed`, `seed:admin`, `faculty:sync`) |
| One-off tools              | `vp dlx <tool>`                                                                      |
| Upgrade                    | `vp upgrade`, then `vp migrate`                                                      |

- `vite.config.ts` imports `defineConfig` from `vite-plus`. Lint, format, test and `staged` settings are blocks inside it. The `staged` block runs `vp check --fix` as the pre-commit step, so there is no Husky.
- Do not hand-edit the `vite` alias entries that Vite+ writes under pnpm. `vp create`, `vp migrate` and `vp upgrade` manage them.

---

## Project Structure (target)

```
unilink/                         # repo name until the app name is chosen
├── package.json                 # engines.node pinned; scripts run through `vp run`   [P0]
├── .node-version                                                                       [P0]
├── vite.config.ts               # vite-plus config: plugins, lint, fmt, test, staged   [P0]
├── wrangler.jsonc               # staging + production envs, D1, assets, AI, crons     [P0]
│                                # + R2 bucket POST_PHOTOS                              [P12]
├── drizzle.config.ts                                                                   [P0]
├── index.html                   # inline no-flash theme script + theme-color meta      [P1]
├── PRODUCT.md                   # product facts read by design work                   [P4b]
├── DESIGN.md                    # the built design language (tokens, type, components)[P4b]
├── .impeccable/surfaces/        # design direction contract for the app shell          [P4b]
├── drizzle/                     # generated migrations (committed)
├── data/
│   └── curricula/               # one JSON curriculum per program (import format)     [P4]
├── docs/
│   ├── api-contracts.md         # agreed endpoint list; shapes live in src/shared       [P0]
│   └── *.md                     # SRS, diagrams, survey, test cases, data formats (see docs/README.md)
├── scripts/
│   ├── seed.ts                  # curricula + fake students for dev/tests             [P0→P4]
│   ├── seed-admin.ts            # first admin from env vars                            [P2]
│   └── faculty-sync.ts          # OpenAlex/ORCID → trim → DeepSeek → admin route       [O1]
└── src/
    ├── shared/                  # imported by both client and server
    │   ├── schemas/             # Zod request/response schemas per module
    │   ├── studentId.ts         # regex, split into key + suffix, admission year       [P2]
    │   ├── themes.ts            # theme list (id, name, blurb, swatches)          [P1, P4b]
    │   ├── prereq.ts            # Composite rule tree (all/any/credits) evaluator      [P4]
    │   ├── grading.ts           # Strategy: grade scale + retake policy + CGPA         [P6]
    │   ├── terms.ts             # term type, current term (Asia/Dhaka)                 [P4]
    │   ├── routine.ts           # overlap check                                         [P9]
    │   ├── resourceUrl.ts       # safe https link rule, shortener list                  [P10]
    │   ├── contact.ts           # phone / wa.me / m.me / facebook.com rules            [P11]
    │   └── webp.ts              # WebP header parser: magic, size, chunks              [P12]
    ├── server/
    │   ├── index.ts             # Hono app, /api router, scheduled() handler           [P0]
    │   ├── limits.ts            # every limit, cap, cooldown, expiry, threshold        [P2]
    │   ├── db/schema.ts         # Drizzle schema
    │   ├── middleware/          # session, requireRole, rateLimit                      [P2]
    │   ├── repos/               # repository layer, one file per aggregate
    │   ├── audit.ts             # audit() + reverse()                                  [P2, P7]
    │   ├── notify.ts            # Observer: notify(userIds, type, payload)             [P5]
    │   ├── moderation/
    │   │   ├── screen.ts        # Chain of Responsibility: rules → model → verdict     [P8]
    │   │   └── rules.ts         # deterministic rules                                   [P8]
    │   ├── adapters/            # openalex, orcid, crossref, deepseek, clef + fakes    [O1, O2, O3]
    │   ├── cron.ts              # list of cleanup jobs, one function per table         [P10]
    │   └── features/<module>/   # routes + services: auth, courses, attempts, inbox,
    │                            # mod, routine, resources, faculty, rides, lostfound,
    │                            # market, finder
    └── client/
        ├── main.tsx
        ├── index.css            # palette tokens, data-theme blocks, shadcn aliases [P1, P4b]
        ├── routes/              # TanStack file routes
        ├── components/ui/       # shadcn components
        ├── components/theme/    # ThemeProvider, ThemePicker, ThemePickerTrigger       [P1]
        ├── components/post/     # ContactInput, ExpiryBadge, ReportButton, StatusNote  [P11]
        └── lib/                 # query client, api fetcher, imageEncode.ts (WebP) [P12]
```

Tests sit next to the code: `*.test.ts` for unit tests and `*.api.test.ts` for API tests that run against a local D1.

---

## Phase numbering

Phases are numbered 0 to 15 in **build order, not strict sequence**. Two developer tracks run in parallel (see Suggested Build Order). Within a track, do one phase at a time and pass its gate before moving on. A phase may start once its **Depends on** phases have passed their gates. Stretch work uses the `S` prefix (S1 to S3) and stays parked until the go/no-go at the start of Sprint 4. Phase 4b (design language) was inserted on 2026-10-20 and keeps the letter so later numbers stay stable. Phase 9b (grade planner) was inserted the same way on 2026-11-02. On 2026-11-12 the phases after 10 were renumbered so rides, lost and found and marketplace come first (old 12, 15, 16 are now 11, 12, 13; Clef stays 14; hardening and delivery are 15 and 16), and faculty profiles and the finder (old 11 and 13) became optional phases O1 and O2 at the bottom. Later the same day Clef auto-moderation (14) became optional phase O3, and hardening and delivery became 14 and 15. Phase 13b (help and contact admins) was inserted the same day, after marketplace. Phase 11b (ride map) was inserted the same day, after rides and before lost and found.

Each phase header carries **Owner · When · Depends on**. "Docs & QA (C, D)" checklists inside a phase are the non-developer work tied to that feature. They do not block the dev's gate unless the gate says so.

---

## Phase 0 — Repo, stack proof & pipeline

**Owner:** Dev A + Dev B (Dev B owns Router and Query setup) · **When:** Week 0 (a few days) · **Depends on:** nothing

**Goal:** A hello-world PWA on the exact final stack is deployed to staging from CI, reads a row from staging D1, and is installed on one Android phone and one iPhone.

> **Justification:** Vite+ is in beta, and the Router, Cloudflare and PWA plugins all need to work under it. A conflict found now costs hours. Found in Sprint 3, it costs a feature.

> **Design decisions (locked in):**
>
> - Stack as in Tech Stack Decisions. `vite-plugin-pwa` ≥ 1.3.0. Pin exact versions once everything works.
> - Two environments: staging (deployed on every merge to `main`) and production (deployed by tag).
> - Secrets (`DEEPSEEK_API_KEY`, `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD`) are Worker secrets per environment, plus a git-ignored `.dev.vars` locally. Never in the repo.
> - The Workers AI binding is named `AI` and is declared in both environments. It needs no secret.

### Checklist — Repo & workflow

- [x] Git repo with protected `main`, feature branches and pull requests. Issue tracker with labels for severity, owner and requirement ID.
- [x] Pin Node (`engines` in `package.json` + `.node-version`) and the exact Vite+ version.
- [x] `vp create` (React + TypeScript). `vp add` hono, zod, drizzle-orm, drizzle-kit, wrangler, `@cloudflare/vite-plugin`, `vite-plugin-pwa`, `@tanstack/react-router` + router plugin, `@tanstack/react-query`, tailwind v4, react-hook-form, `@hookform/resolvers`.
- [x] One `vite.config.ts` from `vite-plus` with the plugins plus `lint`, `fmt`, `test` and `staged` blocks (`staged` runs `vp check --fix`).

### Checklist — Worker, D1 & deploy

- [x] `wrangler.jsonc` with `staging` and `production` envs, each with its own D1 binding `DB`, the static assets binding (SPA fallback to `index.html`), the `AI` binding and an empty cron trigger list.
- [x] Drizzle `src/server/db/schema.ts` with an `app_meta` table. Generate the migration and apply it locally and to staging.
- [x] Hono app mounted at `/api`. `GET /api/health` returns `{ ok: true, dbVersion }` read from `app_meta`. Every non-`/api` path falls through to static assets.
- [x] Package scripts: `db:generate`, `db:migrate:local`, `db:migrate:staging`, `db:migrate:prod`, `deploy:staging`, `deploy:prod`, `seed`. Each one is called through `vp run`.
- [x] CI (`setup-vp`): `vp install --frozen-lockfile`, `vp check`, `vp test`, `vp build`. On merge to `main`, run the staging migrations and then deploy to staging. On a `v*` tag, deploy to production (the production migration is a manual step, see Phase 14).
- [ ] Secrets set in staging and production. `.dev.vars` and `.env*` are in `.gitignore`.

### Checklist — Client stack

- [x] TanStack Router file routes: a root route, `/` and a demo route with one Zod-validated search param. A QueryClient provider. The `/` loader prefetches `/api/health`.
- [x] `vite-plugin-pwa` with a minimal manifest and service worker, so the hello-world can be installed.
- [x] shadcn/ui initialised. Base components agreed and added: button, input, textarea, select, checkbox, radio-group, dialog, form, tabs, toast (sonner), badge, card. Note (2026-10-18): the current shadcn style (`base-nova`, Base UI) has no `form` item; forms use its `field` + `label` components with React Hook Form.

### Checklist — Test harness

- [x] A unit test runs under `vp test`.
- [x] An API test calls the Hono app (`app.request()`) against a local D1. Try `@cloudflare/vitest-pool-workers` first. If it clashes with Vite+'s bundled Vitest, use wrangler's `getPlatformProxy()` for the D1 binding. **Record the choice here:** `@cloudflare/vitest-plugin` 1.4.4 (the renamed successor of `vitest-pool-workers`, supports Vitest 5), as an `api` test project in `vite.config.ts` with `remoteBindings: false`. No fallback needed. (2026-10-18)
- [x] `scripts/seed.ts` stub that the API tests use for fixture data.

### Checklist — Accounts, limits & contracts

- [x] DeepSeek account with a small prepaid balance. Confirm the model name and price on DeepSeek's pricing page and store the key as a secret.
- [x] Read the Clef-flash model page: price, free daily allowance, context size, call format. Note the findings under Open decisions.
- [x] Check the current Workers, D1 (rows read and written per day) and cron free-tier limits and note them under Open decisions.
- [x] `docs/api-contracts.md`: the endpoint list for auth, courses, attempts, inbox, resources, rides, lost and found, marketplace and faculty, with the `notify()` and `screen()` signatures. Shapes are written as Zod stubs in `src/shared/schemas/`.

### Checklist — Docs & QA (C, D)

- [x] C: start the SRS and write the elicitation survey. (`docs/srs.md`, `docs/elicitation-survey.md`)
- [x] D: start the Figma flows (mobile-first). Agree the course spreadsheet columns with Dev A (code, title, credits, category, prerequisites expression, non-credit flag, curriculum version). (Flows are specified in `docs/screens.md` in place of a Figma file; columns in `docs/data-formats.md`.)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/smoke.test.ts`: a trivial unit test.
- [x] `src/server/features/health/health.api.test.ts`: `/api/health` returns `ok` and reads D1.
- [x] Run: `vp check && vp test && vp build`

### Test Gate 0

- [x] **CI is green on `main`, and a merge deploys to staging automatically.**
- [x] **The staging URL serves the app, and `/api/health` returns a value read from D1.**
- [x] **`vp dev` runs with the Router, Cloudflare and PWA plugins together, and HMR works.**
- [x] **(Manual) The app is installed to the home screen on Android Chrome and iOS Safari and opens standalone.** Android done (2026-10-18); iOS pending.
- [x] **If anything forced a fallback from Vite+, the decision is recorded in this phase.**

> **Out of scope for Phase 0:** real auth, real screens, the offline screen and the update prompt (Phase 3).

---

## Phase 1 — Theme system & UI base

**Owner:** Dev B · **When:** Week 0, alongside Phase 0 · **Depends on:** Phase 0 (scaffold)

**Goal:** The installed app switches between the four palettes from Settings, keeps the choice after a restart, and never flashes the default colors on load.

> **Justification:** Every later screen is built on tokens. Retrofitting tokens after hard-coded colors spread is the expensive path.

> **Design decisions (locked in):**
>
> - Palettes: **Ocean Teal** (default), **Red Gradient**, **Cherry Blossom Bloom**, **Cherry Red**, ported from the tested mock site. A theme changes colors only, not layout. `ceiling:` no dark mode. Revisit only after launch if users ask.
>   Note (2026-10-20): Phase 4b keeps these four palettes and ids but reorganizes their colors into shared roles (still no OS-driven dark mode). Later the same day a fifth palette, Night, was added as a hand-picked dark mode.
> - Tokens (CSS variables): app background, hero gradient start and end (removed in Phase 4b), primary, accent, ink, soft, faint, body, line, tint, chip, deep, hero sub-text, **surface**. The default is defined in Tailwind v4's `@theme`. Every other palette is a `:root[data-theme="<id>"]` block that overrides the same variables.
> - shadcn's variables (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring`, …) are aliases of the tokens. Focus rings use the accent token.
>   Note (2026-10-18): the accent token is named `brand` (`text-brand`, `border-brand`) because shadcn's `accent` is a subtle hover fill, which aliases `tint`.
> - `ThemeProvider` at the root route sets `data-theme` on `<html>` and saves the choice in `localStorage` under `<appname>-theme`. If the saved value is missing or unknown, or storage throws (private mode), it falls back to Ocean Teal.
> - An inline script in `index.html` applies the saved theme and sets `<meta name="theme-color">` to the theme's hero color before first paint. The manifest's `theme_color` and the icons stay static Ocean Teal.
> - Picker: `ThemePickerTrigger` on Settings (the current palette's swatches and name), which opens a sheet with all palettes. It uses `role="radiogroup"` and `aria-checked` and works with the keyboard.
> - Adding a palette = one CSS block + one entry in `src/shared/themes.ts`.
> - Contrast: body text ≥ 4.5:1, large text and controls ≥ 3:1, including text on primary buttons and on the hero gradient. A palette that fails is fixed before it ships.

### Checklist — Tokens & provider

- [x] Tokens and the four palettes in `src/client/index.css`, with the shadcn aliases mapped.
- [x] `src/shared/themes.ts` with id, name, blurb and five swatch colors per theme.
- [x] `ThemeProvider` (read with try/catch, validate against `themes.ts`, set `data-theme`, save, update the `theme-color` meta).
- [x] Inline no-flash script in `index.html` (same key, same validation, same fallback).
- [x] Settings route with `ThemePickerTrigger` and the sheet. Decide the open item "mock `BottomSheet` vs shadcn Drawer" here and record it: `shadcn Sheet with side="bottom"` (Base UI dialog: focus trap, Escape and a11y for free, no extra dependency; Drawer would add `vaul` for a drag gesture we do not need, and the hand-rolled `BottomSheet` is dropped).

### Checklist — Docs & QA (C, D)

- [x] D: contrast check for every palette (body text, large text, controls, text on primary buttons, text on the hero gradient). Failures are fixed in `index.css`. (2026-10-20: moved to Phase 4b, which checks the reorganized palettes instead.) Computed in `docs/contrast-check.md`; all pass.

### Checklist — Test Scripts & Smoke Tests

- [x] `src/client/components/theme/ThemeProvider.test.tsx`: reads a saved theme, ignores an unknown value, falls back when storage throws, sets `data-theme`, saves changes, updates the `theme-color` meta.
- [x] `src/shared/themes.test.ts`: every non-default theme in `themes.ts` has a `:root[data-theme="<id>"]` block in `index.css`, **and** the inline script in `index.html` knows the same ids and hero colors (the script cannot import `themes.ts`, so this test stops the copies from drifting apart).
- [x] Run: `vp test theme`

### Test Gate 1

- [x] **Theme tests pass.**
- [x] **The hard-coded color search (Quick Reference) finds nothing in `src/client` outside `index.css`.**
- [ ] **(Manual) On the installed app, switching theme and restarting keeps the choice, with no flash of Ocean Teal, and the status bar color matches.**
- [ ] **(Manual, D) Every palette passes the contrast check.**

---

## Phase 2 — Auth, roles & abuse limits

**Owner:** Dev B · **When:** Sprint 1 (Weeks 1-2) · **Depends on:** Phase 0

**Goal:** Students sign up with username, password and a valid NSU ID, log in with a cookie session, and are held to signup limits and a new-account cooldown. Roles are enforced on every route, and the first admin is seeded.

> **Design decisions (locked in):**
>
> - **Student ID** format `YY S IIII SSS`, validated with `^\d{2}[123]\d{4}(042|642)$` after stripping spaces and dashes. The first 7 digits are the unique key (one account per student). The last 3 are stored separately. The first 2 digits (admission year) select the curriculum version. The ID is private, and only the username is public.
>   Note (2026-10-18): hardened. The suffix is a verification digit (`0` = documents verified, `6` = not yet) plus a two-digit program code, so the pattern is now `^\d{2}[123]\d{4}[06]\d{2}$` and the code must be in the NSU program list in `src/shared/studentId.ts` (undergraduate and graduate). The admission year must not be after the current year in Asia/Dhaka, and not more than `STUDENT_ID_MAX_AGE_YEARS` (8) years before it. Both forms of one ID share the 7-digit key. This only rejects obviously fake IDs; ownership is still unchecked.
>   Note (2026-10-18): signup also takes the full name and the NSU student email. The name is trimmed with spaces collapsed (2 to 80 characters). The email is lowercased and must end in `@northsouth.edu` (only the domain is checked, because the local part varies). Both are private, are never in a response, and the email is unique (`users.full_name` nullable for the seeded admin). The email is still not verified: `email_verified_at` stays null.
> - **No email verification in the MVP** (accepted risk: the format is checked, ownership is not). `users.email` and `users.email_verified_at` exist and are nullable, so verification can be added later without a migration. Mitigations: the unique ID key, signup rate limits, the new-account cooldown before posting or submitting links, and the mod ID-conflict tool (Phase 7).
> - **Passwords:** WebCrypto PBKDF2-SHA-256 with a random salt per user. Workers cap PBKDF2 at 100,000 iterations, so use that number. Store the algorithm and iteration count with the hash so it can change later.
> - **Sessions:** a random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie. Only its SHA-256 hash is stored in `sessions`. Logout and password change delete the session rows.
> - **Roles:** `student`, `mod`, `admin`, checked by `requireRole()` middleware. A banned user's sessions are rejected.
> - **First admin** is seeded from env vars and has `must_change_password = true`. The same flag is used for mod-issued temporary passwords (Phase 7). While it is set, every route except change-password returns 403.
> - **Rate limiting:** one `rateLimit(key, limit, windowMs)` helper backed by a D1 `rate_limits` table (key, window start, count). Every later limit uses it: contact reveal, match, gate, post creation, probing cooldown.
> - All values (signup per IP per hour, login attempts, cooldown length) live in `limits.ts`. Suggested defaults until the team decides: signup 5 per IP per hour, login 10 per username per 15 minutes, cooldown 24 hours.

### Checklist — Schema & helpers

- [x] Tables: `users` (username unique, `student_key` unique, `student_suffix`, admission year, password hash/salt/params, role, `banned_at`, `must_change_password`, `email` nullable, `email_verified_at` nullable, `created_at`), `sessions`, `audit_log`, `rate_limits`.
- [x] `src/shared/studentId.ts`: normalise, validate, split into key, suffix and admission year.
- [x] `src/server/audit.ts`: `audit({ actor, action, targetType, targetId, before, reason })`. Reversal comes in Phase 7.
- [x] `src/server/middleware/`: session loader, `requireUser`, `requireRole`, `rateLimit`, and a `canPost(user)` cooldown check for later phases.
- [x] `src/server/limits.ts` created with the auth values.

### Checklist — API & screens

- [x] `POST /api/auth/signup`, `/login`, `/logout`, `/change-password`, `GET /api/auth/me`.
- [x] Signup and login are rate-limited. A duplicate 7-digit key gets a generic "this ID is already registered, contact a mod" message.
- [x] `scripts/seed-admin.ts` (`vp run seed:admin`) creates the first admin from env vars.
- [x] Screens: sign up, log in, change password (forced redirect when the flag is set), log out in Settings.

### Checklist — Docs & QA (C, D)

- [ ] C: SRS draft, use case diagram, survey sent out. (Drafted: `docs/srs.md`, `docs/use-cases.md`. The survey still has to be sent.)
- [x] D: login and signup screens in Figma. Test cases for signup, login, the forced password change and the ID format. (Test cases: `docs/test-cases.md`, sections A and B. Screens: `docs/screens.md`, in place of Figma.)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/studentId.test.ts`: valid IDs with suffix 042 and 642, semester digit 1 to 3 only, wrong lengths, spaces and dashes, the split.
- [x] `src/server/features/auth/auth.api.test.ts`: a duplicate key is rejected, the cookie flags are set, only a hashed token is stored, a banned user is refused, a student calling a mod route gets 403, `must_change_password` blocks other routes, signup and login rate limits trigger, the cooldown blocks `canPost`.
- [x] Run: `vp test auth studentId`

### Test Gate 2

- [x] **All auth tests pass in CI.**
- [x] **On staging, sign up → log in → log out works on a phone, and the seeded admin is forced to change the password.**

---

## Phase 3 — PWA shell

**Owner:** Dev B · **When:** Sprint 1 · **Depends on:** Phase 0, Phase 1

**Goal:** The app installs with proper icons, opens instantly from the cached shell, shows a clear offline screen without a connection, and prompts "Update available, reload" after a new deploy.

> **Design decisions (locked in):**
>
> - One installable web app for all platforms. Users "Add to Home Screen" (Android Chrome, iOS Safari). `ceiling:` no app store or native build.
> - The service worker precaches the app shell only (hashed JS, CSS, icons). `index.html` is network-first. `/api/*` is never cached (network-only).
> - Update flow: `registerType: 'prompt'`. The app checks for a new service worker on launch and shows a toast: "Update available, reload".
> - Offline: when navigation or the first API call fails with no network, show a full "You are offline" screen with a retry button. There is no offline data.
> - iOS: show a one-time "Add to Home Screen" hint in Safari when the app is not running standalone. Web push is stretch (S3), and the inbox is the source of truth.
> - Contacts later use `tel:`, `https://wa.me/…` and `https://m.me/…` links, which open the dialer or chat app directly.

### Checklist — Shell

- [x] Manifest: name, short_name, start_url, `display: standalone`, Ocean Teal `theme_color` and `background_color`, icons 192, 512 and maskable, `apple-touch-icon`. Placeholder icons until the app name and icons are decided.
- [x] Service worker config as locked above (precache the shell, network-first `index.html`, network-only `/api`).
- [x] Offline screen route/component and an `isOffline` check in the API fetcher.
- [x] Mount `<Toaster />` once in the app layout. Replace the `next-themes` `useTheme()` call in `ui/sonner.tsx` with a fixed `theme="light"` (themes change colors only, and the toast already uses our tokens through the shadcn aliases).
- [x] Update prompt with `useRegisterSW` from `virtual:pwa-register/react`, checked on launch.
- [x] iOS install hint, dismissible, with the dismissal remembered in `localStorage` (inside try/catch).
- [x] App layout shell (navigation, header, Home placeholder) per D's Figma, responsive.

### Checklist — Docs & QA (C, D)

- [x] D: PWA test cases (install on both platforms, offline screen, update prompt, small phone and desktop layouts).

### Checklist — Test Scripts & Smoke Tests

- [x] `src/client/lib/installHint.test.ts`: the hint shows only in iOS Safari when not standalone and not dismissed.
- [x] Run: `vp test installHint && vp build` (then check `dist/` for hashed asset names)

### Test Gate 3

- [x] **(Manual) In airplane mode, the installed app opens to the offline screen on Android and iOS.**
- [x] **(Manual) After a new staging deploy, relaunching shows the update prompt, and reloading shows the new build.**
- [x] **(Manual, DevTools) No `/api` response is served from the service worker cache.**

**Sprint 1 milestone (Phases 2-4):** a user can sign up, log in, see their program's course map and install the app.

---

## Phase 4 — Course map & prerequisites

**Owner:** Dev A · **When:** Sprint 1 · **Depends on:** Phase 0 (Phase 2 for the logged-in user)

**Goal:** Mods import the NSU undergraduate curricula, and students see the course map for their program and curriculum version with categories, credit totals, prerequisite status and done courses taken from their attempts. Students fill elective slots with their own courses and may go over the degree total.

> **Design decisions (locked in):**
>
> - Curriculum is imported from CSV or JSON by a mod (D prepares the data). Courses have code, title, credits, category, a non-credit flag and a prerequisite rule. They belong to a curriculum version chosen by admission year.
>   Note (2026-10-19): every undergraduate program with a course map is imported, not only CSE. A curriculum belongs to an NSU program code (the last two digits of the student ID, `NSU_PROGRAM_CODES`) and has a version label, an `effectiveFromYear` (YY) and a degree total. A student's curriculum is the one for their program with the highest `effectiveFromYear` not after their admission year, else the oldest one for that program. A program with no curriculum shows an empty state. The import format is JSON only (one file per curriculum, `curriculumImport` in `src/shared/schemas/courses.ts`); the source files live in `data/curricula/`. Re-importing the same program + version replaces its courses. Graduate programs are out of scope. `ceiling:` no data for ETE (no program code in the list), English (the supplied file was the LLB map), Anthropology, Sociology, History or Environmental Science; add a file when D has the map.
> - Prerequisites are a **Composite** rule tree: a course leaf, `all` groups and `any` groups. They are evaluated in `src/shared/prereq.ts`.
>   Note (2026-10-19): one more leaf, `{ credits: n }`, is met when the student has earned at least `n` degree credits (for "60 credits completed" style rules). A waiver ("ENG102/Waiver") is stored as the plain course leaf.
> - Course rows have a `kind`. A `course` row is a fixed course; it may list `alternatives` (other codes that fill the same slot, e.g. POL101/POL104, or "choose any three" written as three slots with the same options). A passing attempt fills at most one slot, assigned in curriculum order. An `elective` row is a placeholder (ELECT1, OPEN ELECT, a BBA major course, …) with a category and credits but no fixed code.
> - **Student courses** (decided 2026-10-19): students add their own courses with a code, title, credits and a category taken from their curriculum's categories (default the first elective category). They fill that category's elective placeholders in the order they were added; any beyond the placeholders show as extra. A student course code must not clash with a code in their curriculum or another of their own. Student courses are private to their owner (same repo-layer rule as attempts) and are not posts, so they are not screened. `ceiling:` `limits.studentCoursesMax` per user, to bound D1 rows.
> - **Going over the degree total** (decided 2026-10-19): there is no cap on earned credits. Totals show e.g. 136 / 130 with no block. Any student course can be marked **excluded from transcript**: it keeps its attempts and stays on the map with an "Excluded" badge, but counts toward no total, no `credits` prerequisite and (Phase 6) no CGPA. Curriculum courses cannot be excluded.
> - **Attempts are the only source of truth** (decided 2026-10-18). A course is _done_ when it has a passing attempt (any grade that earns credits, so not F, I or W). The "tick" on the map opens a quick attempt form: course + letter grade, with term and faculty optional. Phase 6 adds the full form and the retake rules. There is no separate ticks table. An attempt's course code must be in the student's curriculum (a slot code or an alternative) or one of their student courses.
>   Note (2026-10-19): any course can be **waived**. A waiver is an attempt with grade `WV` ("Waived" in the form), so attempts stay the only source of truth. It makes the course done and earns its credits (degree totals and `credits` prerequisites), but it has no grade points and never counts in CGPA. The map marks a course "Waived" when a waiver is its only passing attempt; a later graded pass replaces it.
> - **Elective trails and open electives** (decided 2026-10-21):
>   - A curriculum file may carry an optional `electiveTrails` header block: `{ category, minFromOneTrail, trails: [{ name, courses: [{ code, title, credits }] }] }`. `category` must be the category of at least one elective slot in the file, trail course codes follow the course code pattern, never repeat across trails and never clash with a slot code or alternative of the file. A bad block rejects the whole file (it is header data, not a row). Stored in a new `elective_options` table (curriculum, trail, position, code, title, credits; unique per curriculum and code) plus a nullable `elective_rule` JSON column on `curricula` (`{ category, minFromOneTrail }`). Re-importing or re-seeding replaces the options together with the courses in the same batch. `ceiling:` only CSE has trails transcribed; other programs add the block when D has their lists. Mods change trails only by re-importing; revisit if trail lists change between imports often.
>   - Students still fill trail elective slots with **student courses** (the slot-filling rule above is unchanged). The "Add course" action on a trail category opens a trail picker: every trail with its courses, searchable, already-added ones marked; one tap adds a student course with the listed code, title and credits in that category. A "Course not listed" link opens the usual student course form, because NSU adds special-topics courses; such a course counts its credits but belongs to no trail.
>   - Trail progress is worked out by the map, not stored: a student course in the trail category whose code is in a trail counts for that trail (excluded courses never count; a trail course filed under another category counts there, not toward a trail). The category carries `trails` in the map response: each trail with its done and added counts and per-course state, the leading trail, and `met` when some trail has at least `minFromOneTrail` done courses. The rule is shown, never enforced: a student is not blocked from adding courses that do not satisfy it.
>   - **Open elective**: any course from any discipline. The student course form looks the typed code up (`GET /api/courses/lookup?code=`, exact match only, through an index on `courses.code` and `elective_options.code`) in every imported curriculum and trail list, and fills an empty title and credits from it. The existing clash rule still refuses a code that is already in the student's curriculum. "A course like one already taken does not count" cannot be checked from codes, so the form says it in a hint instead.
>   - Empty elective slots say what fills them: "Pick from a trail" in a trail category, "Any discipline" otherwise (they all said "open elective" before). A category whose slots are all non-credit shows "Non-credit" in place of "0 / 0 cr".
>   - CSE498 Internship/Co-op (minimum 8 to 12 weeks) is a non-credit `course` row in the CSE file, category "Internship", semester 12, no prerequisite.
> - Terms: a shared `Term` value (year + Spring/Summer/Fall). The current term is worked out in Asia/Dhaka from one set of term start dates in `src/shared/terms.ts` (D confirms the dates).

### Checklist — Data & API

- [x] Tables: `curricula` (program code, name, version, `effective_from_year`, total credits), `courses` (kind, alternatives and the prereq rule stored as JSON), `attempts` (user, course code, grade, term nullable, created_at), `student_courses` (user, code, title, credits, category, excluded, created_at). Faculty is added in Phase 6.
- [x] Import endpoint (mod only), validated by a Zod schema. It reports the rows it rejected and why. The import is logged with `audit()`.
- [x] `GET /api/courses/map` returns the student's curriculum with each slot's status for the current user (done, available, locked), their student courses filling elective slots and extras, plus category and degree credit totals (which may exceed the required total; excluded courses never count).
- [x] `POST /api/attempts` (quick form). Attempts are visible only to their owner and never to mods (enforced in the repo layer).
- [x] Student courses API: list, add, edit (including the excluded flag), delete. Owner only, capped by `limits.studentCoursesMax`.

### Checklist — Curriculum data

- [x] `data/curricula/*.json`, one file per program, transcribed from the NSU course maps: Architecture, LLB, MCJ, Public Health, Economics, CEE, Environmental Management, BBA, CSE, EEE, Pharmacy, Biochemistry & Biotechnology, Microbiology.
- [x] A unit test validates every file against `curriculumImport` and checks that every prereq course leaf points at a code in the same file.

### Checklist — Elective trails and open electives

- [x] `electiveTrails` in `curriculumHeader` (shared schema), migration for `elective_options`, `curricula.elective_rule` and the `courses.code` index; import route and seed store and replace the options with the courses.
- [x] `data/curricula/42-cse.json`: the six CSE trails (Algorithms and Computation, Software Engineering, Networks, Computer Architecture and VLSI, Artificial Intelligence, Bioinformatics) with minimum two from one trail, and the CSE498 Internship/Co-op row. Local D1 migrated and re-seeded.
- [x] Course map: `trails` on the trail category (per-trail counts and course states, leading trail, `met`). `GET /api/courses/lookup?code=` for title and credits.
- [x] Screens: trail progress in the trail category header, the trail picker sheet behind "Add course", lookup autofill and the open elective hint in the student course form, slot hints for empty elective slots, "Non-credit" for an all-non-credit category.
- [x] Tests: the schema rejects a bad trail block (clash with a slot code, a repeated code, an unknown category); the curriculum data test checks trails; map tests for trail counts, `met`, excluded and other-category courses; lookup API test (found in another program, found in a trail, unknown is 404); seed test for the options; UI tests for the progress line and picking a trail course.
- [x] `docs/data-formats.md` documents the `electiveTrails` block.

### Checklist — Screens

- [x] Course map screen: grouped by category, with credit totals (over-total allowed) and status chips. Tapping a course opens its prerequisites and the quick attempt form. Elective slots show the student course filling them, or an "Add course" action.
- [x] Student course form (code, title, credits, category, excluded toggle) built from the shared schema.
- [x] Mod-only curriculum import screen: upload a JSON file, show the imported count and the rejected rows.

### Checklist — Sequence view (desktop)

> **Design decisions (locked in, 2026-10-25):**
>
> - From `md` up, the course map has a **List / Sequence** toggle. List stays the default and the only view on phones. The choice lives in the URL (`/courses?view=sequence`).
> - Sequence draws the curriculum like the NSU "Recommended sequence of courses" sheet: one row per semester (plus "Unscheduled" for a null semester, and a last row for extra student courses), each row's credit total on the right, prerequisite lines between courses. It is built entirely on the client from `GET /api/courses/map`; no API or schema change.
> - **Layout** is a pure function (`src/client/lib/courseSequence.ts`) that mirrors the NSU sheet: a compact grid with as many columns as the busiest semester (labs merged), at least four. Courses of a general-education category (name matches "general education" or "GED") sit in the right-most columns, as on the sheet. Every other course takes the free column nearest the average column of its prerequisites, so chains run straight down; courses without prerequisites fill from the left in curriculum order. The result is stable. No ELK or dagre: they don't respect fixed semester rows.
>   Note (2026-10-25): replaces per-category lanes, which spread CSE over about eleven sparse columns and forced the canvas to zoom out until nothing was readable.
> - **Labs:** a lab row (theory code + `L`, same semester) is merged into its theory course as one node (`CSE115 + L`). Clicking a merged node splits it into two nodes, theory and lab side by side, each with its own state mark; clicking either opens its course sheet. Clicking elsewhere or Esc merges it back.
> - **Edges:** a course leaf or `all` group draws a solid line; an `any` group draws dashed lines. A leaf naming an alternative code points at the slot that holds it. A `{ credits: n }` leaf draws no line: the node gets a † mark with a footnote ("after n credits").
> - **Rendering:** React Flow (`@xyflow/react`), lazy-loaded only when Sequence opens, used only to draw nodes and right-angle (`smoothstep`) lines with arrowheads. The sheet is drawn at 1:1 scale: column width follows the available width, the canvas is as tall as its rows, and the page scrolls (no zoom, pan, controls or minimap). Nodes print the code first (`CSE215 + L`), the title below it.
> - **Page:** in Sequence the page uses the full content width. The degree standing and the CGPA summary sit at the top (CGPA summary on the right, as in List), the sheet below them.
> - React Flow's `--xy-*` variables are mapped to theme tokens in `src/client/index.css`. Flat nodes with `StateMark` and the course hue; alternating semester bands; no shadows.
> - Hovering or focusing a course highlights its prerequisite chain and what it unlocks and dims the rest. Clicking opens the existing `CourseSheet`.

- [x] `courseSequence.ts`: rows, columns (general education on the right, others under their prerequisites), lab merge and split, edges (solid, dashed, alternatives), credit-rule notes, row credit totals.
- [x] Sequence screen: toggle (hidden below `md`, `?view=` search param), lazy React Flow canvas, themed nodes and edges, hover/focus highlight, lab split on click, course sheet on click.
- [x] Tests: `courseSequence.test.ts` (CSE rows sum to 130, lab merge and split, nested `all`/`any` edges, `credits` leaf note, alternative target, stable order, null semester row); UI test (toggle hidden on phones, nodes render, click opens the sheet, merged node splits).

### Checklist — Docs & QA (C, D)

- [x] D: course map screens. Check the transcribed curriculum files against the official maps. (Screens: `docs/screens.md`. All 13 files checked row by row against their source maps on 2026-10-20; CSE gained BEN205 and HIS103 as alternatives. MCJ credits and PBH credits and titles are inferred where the maps print none, as their notes say.)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/prereq.test.ts`: leaf, nested `all`/`any`, empty rule, a `credits` leaf, an F, I or W attempt does not satisfy a prereq, a passing attempt does.
- [x] `src/server/features/courses/courses.api.test.ts`: the import rejects bad rows, only mods can import, the map reflects attempts, the user only sees their own attempts and student courses, the curriculum follows program code and admission year, student courses fill elective slots then show as extra, totals can exceed the degree total, an excluded course counts toward nothing.
- [x] `scripts/seed.ts` now seeds the curricula from `data/curricula/` and two fake students.
- [x] Run: `vp test prereq courses`

### Test Gate 4

- [x] **Prereq and course API tests pass.**
- [x] **Every file in `data/curricula/` passes the curriculum data test.**
- [x] **On staging, a seeded student records a grade from the map, and the course turns done and unlocks its dependants.**
- [x] **(Manual) On staging, a student fills an elective slot with their own course, adds an extra course that takes them over the degree total, then excludes it, and the totals update each time.**

---

## Phase 4b — Design language & restyle

> **(2026-10-24) The Pocket Planner restyle is done and supersedes this phase's visual locks; [`build_plan_pocket_planner.md`](build_plan_pocket_planner.md) records the built system. The non-visual locks stay.**

**Owner:** Dev B (Dev A reviews) · **When:** Sprint 2, before Phase 5 and Phase 7 add screens · **Depends on:** Phase 1, Phase 3, Phase 4

**Goal:** UniLink gets one calm, consistent look, Quiet Utility. Phase 1's four palettes are kept and reorganized into the same set of roles, and every existing screen is rebuilt in this look before later phases add more.

> **Justification:** 14 phases of screens are still to come. Restyling 8 routes now costs less than restyling 30 later, and the post kit (Phase 11) should be built once, in its final form.

> **Design decisions (locked in):**
>
> - **World:** Quiet Utility, a calm productivity app in the spirit of Linear or Things. Neutral ground, content on plain surfaces separated by hairlines, lists rather than card grids, generous whitespace, and one accent color per palette. Rank comes from weight and spacing, not from color or decoration. The direction contract lives in `.impeccable/surfaces/src-client.md`, and `DESIGN.md` records the built system when this phase finishes. `PRODUCT.md` holds the product facts that design work reads.
>   Note (2026-10-20): replaces the Picture-House Billboard direction, which was dropped before it shipped.
> - **Palettes:** Phase 1's four stay, with the same ids so saved choices keep working: Ocean Teal (default), Red Gradient, Cherry Blossom Bloom and Cherry Red. Each one is reorganized into the same roles: a neutral ground tinted toward its hue, a `surface` one step lighter, an `ink` that is never pure black, `soft` and `faint` text tiers, a `line` hairline for dividers, an `edge` border for controls, one `brand` accent (also `primary`), a `brand-soft` fill for selected and current rows, and a `danger` color. Display names may change (for example, Red Gradient no longer has a gradient). The ids may not. `ceiling:` nothing follows the OS setting. The `dark:` variant never matches.
> - **Night (added 2026-10-20):** a fifth palette, id `night`, is the dark mode: cool charcoal ground, light ink, a mint-teal accent with dark text on primary, and `color-scheme: dark`. It is picked by hand in Settings like the others. It fills the same roles. Its `deep` is near-black, and both the sheet and dialog overlay and the float shadow are drawn from `deep`, so they darken instead of glowing. Contrast (computed): ink on app 15.2, soft on chip 7.0, faint on tint 5.1, text on primary 9.0, brand on brand-soft 5.8, `edge` on brand-soft 3.5, danger on tint 6.4.
> - **Tokens:** the token class names stay (`bg-app`, `bg-surface`, `text-ink`, `text-soft`, `text-faint`, `border-line`, `bg-tint`, `bg-chip`, `bg-primary`, `text-brand`). `hero1`, `hero2` and `herosub` are removed, and `edge`, `brand-soft`, `danger` and `bar` are added. `<meta name="theme-color">` takes each palette's `bar` color (its ground).
> - **Type:** Geist stays for Latin text. Noto Sans Bengali (variable, through Fontsource) is its fallback for Bangla post text, and the family stack lists it right after Geist. Four sizes at most per screen. Rank comes from weight (400, 500, 600) and spacing, not from more sizes. Headings are sentence case, never all caps. Figures use `tabular-nums`.
> - **Surfaces:** no gradients, glass, glows or resting shadows. Panels are `bg-surface` with a `line` hairline and one panel radius. Controls share one smaller radius. Both radii are decided once and recorded here. Only things that float (sheets, menus, toasts) get a soft shadow.
> - **Course state marks:** one vocabulary everywhere: filled = done, hollow = available, struck = locked, half = waived. Color never carries a state on its own.
> - **Shell:** on phones, a slim wordmark bar plus a bottom tab bar with short labels for the destinations that exist. From `md` up, the same destinations in a plain top bar, with the course-map sidebar where it exists. The active tab shows by weight and ink, never a colored pill. The wordmark is the word "UniLink" only: no university name and no crest-like mark.
> - **Home:** a summary panel heads Home. Until Phase 9 lands it shows the student's degree standing (credits done of the total as one large figure, a thin progress bar in `brand`) and a list of the courses unlocked next. From Phase 9 on, the panel shows the next class (course code, title, room, "starts in 12 min") and changes to the following class when one ends.
> - **App-screen rules** (from the taste skill's app-screen chapter): colors go on data, state and the one primary action, not on chrome. One filled primary per screen. Numbers are right-aligned in tabular figures. A real zero prints as `0` and a missing value as a grey dash. Loading shows the final layout with flat bars, and an error shows inside the block that failed, with a Retry.
> - **Contrast floor** (unchanged from Phase 1): body text ≥ 4.5:1, large text and controls (including `edge` borders) ≥ 3:1 on every palette, including text on primary buttons and on `brand-soft`. A palette that fails is fixed before it ships.
> - `ceiling:` five palettes (four day, one dark). Each extra one adds a full contrast pass. Revisit after launch if users ask for more.
> - **Palette names and roles (built 2026-10-20):** the ids are unchanged. Display names: Ocean Teal (kept), Red Gradient is now **Bordeaux** (id `red-gradient`), Cherry Blossom Bloom is now **Cherry Blossom** (id `cherry-blossom`), Cherry Red (kept). `bar` equals `app` in every palette, `primary` equals `brand`, and `deep` is the overlay color behind sheets and dialogs (it equals `ink` in the day palettes and is near-black in Night). The shadcn aliases are `--input` → `edge` and `--destructive` → `danger`. The picker previews each palette as its ground, ink ("Aa") and accent dot, using the colors in `themes.ts` so the preview never follows the active theme.
> - **Ocean Teal is now Coral (2026-10-23):** id `ocean` unchanged; the Pocket Planner palettes and tokens are in `build_plan_pocket_planner.md`.
> - **Font check (2026-10-20):** Bangla sample text (letters and digits ০–৯) renders in Noto Sans Bengali: every sample codepoint is in the font's Bengali subset, and in the browser both families load (Geist for Latin, Noto for U+0980–09FE through `unicode-range`). Geist's `tabular-nums` works: `1111` at 40px measures 56.6px proportional and 96px tabular (every digit 600 units wide in the font file).
> - **Radii and floating layers (built 2026-10-20):** controls (buttons, inputs, selects, badges, checkboxes, menu items) use `rounded-control` = 6px (`--radius-control`); panels, sheets, dialogs and select popups use `rounded-panel` = 10px (`--radius-panel`). Panels are `bg-surface` with a `line` hairline and no shadow. Only floating layers (sheet, dialog, select popup, toast) get the one `shadow-float`, and none uses backdrop blur. Keyboard focus is one solid `brand` outline from `focusRing` in `components/ui/focus.ts`; a filled button's hover mixes toward `ink` instead of fading.

### Checklist — Palettes & tokens

- [x] The four palettes in `src/client/index.css` reorganized into the roles above, with `edge`, `brand-soft`, `danger` and `bar` added and the shadcn aliases remapped (`--input` → `edge`, `--destructive` → `danger`). Remove `hero1`, `hero2` and `herosub`.
- [x] `src/shared/themes.ts` and the inline script in `index.html` move from `hero` to `bar`. The ids are unchanged, and an unknown id still falls back to Ocean Teal.
- [x] Noto Sans Bengali through Fontsource (`vp add @fontsource-variable/noto-sans-bengali`) as Geist's fallback. Check that Bangla sample text renders in it and that Geist's `tabular-nums` changes digit widths, and record the result.
- [x] Theme picker restyled: each palette previews as its ground, ink and accent.

### Checklist — Components & shell

- [x] shadcn components restyled to the language (button, input, select, sheet, tabs, badge, card, checkbox, radio-group, textarea, dialog, sonner, field): one control radius, `edge` borders, no resting shadows, no opacity hovers on filled buttons, focus ring in `brand`.
- [x] `SectionHeader` (sentence-case title, optional count and action, hairline below) and `StateMark` (filled, hollow, struck, half) as shared components.
- [x] `AppLayout`: wordmark bar, bottom tab bar on phones, top bar from `md` up, active tab by weight and ink.
- [x] Home: the summary panel (degree standing until Phase 9) and the "unlocked next" list, with loading, empty (no curriculum yet), signed-out and error states.
- [x] Courses header: the degree standing (credits done of the total and one short bar per category, all in `brand`).

### Checklist — Collapsible rail (desktop)

> **Design decisions (locked in, 2026-10-25):**
>
> - From `md` up, the side rail can be collapsed to a thin icon-only rail (wordmark becomes its first letter, tab icons stay, labels and the username hide, the avatar stays). Phones keep the floating tab bar unchanged.
> - A collapsed rail expands while hovered or while focus is inside it, **over** the content as a floating layer (`shadow-float`), so the page never reflows. Moving away collapses it again after a short delay. The delay lives as a named constant in the layout code; it is presentation, not a server limit.
> - One button at the bottom of the rail toggles the mode: "Collapse sidebar" while expanded, "Keep sidebar open" while collapsed. Clicking it while collapsed pins the rail open in place and the content reflows to the full rail. The choice is saved on the device (`localStorage`) and restored on load without a flash. Default: expanded.
> - The active tab still shows by weight, ink and the `brand-soft` row; in the thin rail the row is a square around the icon. Every icon link keeps its accessible name when labels are hidden. The width change animates only under `motion-safe`.

- [x] Rail: collapsed and expanded states, hover and focus-within expansion over the content, toggle button, saved choice, no reflow while hover-expanded.
- [x] Tests: the toggle collapses and pins the rail and survives a remount; links keep their names when collapsed; phones never show the toggle.

### Checklist — Restyle existing screens

- [x] Course map, course sheet, attempt form and student course form, with `StatusChip` replaced by `StateMark`.
- [x] Settings, login, signup and change password.
- [x] Offline screen, update prompt and install hint.
- [x] Mod curriculum import.
- [x] Copy pass in the friendly-peer voice (see `PRODUCT.md`). "Your NSU CSE student companion" becomes copy for every program.

### Checklist — Docs & QA (C, D)

- [x] D: contrast check for every palette (body, large text, controls and `edge` borders, text on primary buttons, text on `brand-soft`). Failures are fixed in `index.css`. (`docs/contrast-check.md`: all five palettes pass, no change needed.)
- [x] `DESIGN.md` written from the built system at the end of this phase (tokens, type, components, state marks, do and don't).

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/themes.test.ts` updated: every palette in `themes.ts` has its CSS block with every role token, no `hero*` token is left, and the inline script knows the same ids and `bar` colors.
- [x] `ThemeProvider.test.tsx`: an unknown saved id falls back to Ocean Teal, and the `theme-color` meta takes the `bar` color.
- [x] `StateMark` test: each course status renders its mark with an accessible label, not only a color.
- [x] Run: `vp test theme StateMark`, then `.claude/skills/impeccable/scripts/impeccable detect --json src/client` and fix what it reports.

### Test Gate 4b

- [x] **Theme and component tests pass.**
- [x] **The hard-coded color search (Quick Reference) finds nothing in `src/client` outside `index.css`, and a search for `gradient` in `src/client` finds nothing outside theme ids.**
- [x] **(Manual) Every existing screen is checked at 390px and 1440px on all five palettes: no overlap, no clipped text, and Bangla sample text renders in Noto Sans Bengali.**
- [x] **(Manual, D) Every palette passes the contrast check.**

---

## Phase 5 — Notification inbox

**Owner:** Dev A · **When:** Sprint 2, first item · **Depends on:** Phase 2

**Goal:** Any server code can call `notify()`, and users see their own notifications with an unread count and mark them read.

> **Justification:** Moved to the start of Sprint 2 because Dev B's held-post notifications (Phase 8) and every later fan-out write to it.

> **Design decisions (locked in):**
>
> - The in-app inbox is the source of truth. `ceiling:` web push is stretch (S3).
> - `notify(userIds, type, payload)` is the single **Observer** entry point. Types are an enum in `src/shared/schemas/inbox.ts`. A payload never contains another user's identity.
>
> Note (2026-10-20): web push (S3) is pulled forward into this phase. The inbox stays the source of truth and push is best effort. A user turns it on per device in Settings (iOS only after Add to Home Screen). `notify()` also pushes to the user's subscribed devices through a push adapter with a fake. A push carries only a title and body built on the server from the notification type (shared copy) and a link to `/inbox`, never payload text or anyone's identity. Push endpoints must be on a known push service host. Expired subscriptions (404/410) are deleted. Logging out removes the device's subscription. VAPID keys live in Worker secrets.

### Checklist

- [x] `notifications` table (user, type, payload JSON, `read_at`, `created_at`), indexed on (user, `read_at`).
- [x] `src/server/notify.ts` with batched inserts.
- [x] `GET /api/inbox` (paginated), `GET /api/inbox/unread-count`, `POST /api/inbox/:id/read`, `POST /api/inbox/read-all`.
- [x] Inbox screen and an unread badge in the navigation.

### Checklist — Web push

- [x] `push_subscriptions` table (user, endpoint unique, keys, `created_at`), capped per user by `limits`.
- [x] Push adapter in `src/server/adapters/` (VAPID + payload encryption with WebCrypto) and a fake. `notify()` sends to the targets' subscriptions and deletes expired ones; a push failure never fails `notify()`.
- [x] `GET /api/push/public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`; a script to generate VAPID keys.
- [x] Service worker shows the push and opens `/inbox` on tap. Settings has a per-device "Notifications" switch with the iOS install and blocked-permission states; logout unsubscribes the device.
- [x] `POST /api/push/test` (admin only, to the caller only, rate-limited and audited) and a "Send test" row in Settings, for checking push on a phone.
- [x] `src/server/features/push/push.api.test.ts`: subscribe and unsubscribe, a foreign host is rejected, the cap holds, `notify()` pushes only to targets through the fake, an expired subscription is deleted, push text never contains payload values.

### Checklist — Test Scripts & Smoke Tests

- [x] `src/server/features/inbox/inbox.api.test.ts`: `notify()` writes rows for every target, a user sees only their own, mark-read works, another user's id gets 404.
- [x] Run: `vp test inbox`

### Test Gate 5

- [x] **Inbox tests pass, and the `notify()` signature matches `docs/api-contracts.md`.**
- [x] **(Manual) On staging, with the VAPID secrets set, a test push from Settings (signed in as the admin) arrives on Android Chrome and on iOS after Add to Home Screen, tapping it opens the inbox, and logging out stops pushes to that device.**

---

## Phase 6 — CGPA, attempts & retakes

**Owner:** Dev A · **When:** Sprint 2 · **Depends on:** Phase 4

**Goal:** Students record every attempt (course, term, grade, faculty) and see their best-grade CGPA, retake eligibility and credits remaining by category.

> **Design decisions (locked in):**
>
> - **Scale:** A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, C- 1.7, D+ 1.3, D 1.0, F 0.0. Students enter letter grades only, never numeric scores.
> - **Best grade per course counts**, and credits count once.
> - **F** counts in CGPA as 0.0 but earns no graduation credits. **I and W** are excluded from both CGPA and earned credits. Non-credit courses are excluded from CGPA.
>   Note (2026-10-19): **WV** (waived, Phase 4) earns credits but is excluded from CGPA and from the best grade (`countsInCgpa()` in `grading.ts`). A waived course with no graded attempt never blocks a retake.
> - **Retake rule:** a new attempt is allowed only while the best grade so far (ignoring I and W) is below B+. There is no limit on the number of attempts while that holds. I and W attempts never block a retake.
> - The scale and the retake policy are **Strategy** objects in `src/shared/grading.ts`, so a different scale or policy is a new strategy, not an `if`.
> - The basic `faculty` table is created here for the attempt picker (since extended into the all-department directory, see the 2026-10-20 note at the top). Phase O1 extends it further.
> - Mods and admins cannot read attempts or CGPA. This is enforced in the repo layer, not only in the UI.

### Checklist

- [x] `faculty` table and a seeded list (D) (`data/faculty/*.json`, one file per department; `GET /api/faculty`).
- [x] Faculty picker component.
- [x] Migration: `attempts.faculty_id` (nullable). The full attempt form makes term required for new attempts (`attemptFullInput`; the API keeps term optional for the map's quick form).
- [x] `grading.ts`: grade points, `bestAttempt()`, `cgpa()`, `earnedCredits()`, `canRetake()`.
- [x] Attempt API: create, edit, delete (plus list and `GET /api/attempts/summary`). Create and edit run `canRetake()` and return a clear error when a retake is not allowed.
- [x] Screens: attempt history per course, CGPA summary, credits remaining by category, a retake badge.

### Checklist — Docs & QA (C, D)

- [ ] C: class diagram. Update the SRS from the survey results. (Class diagram written: `docs/class-diagram.md`. The SRS update waits for survey results.)
- [x] D: CGPA screens. First manual test cases. Finish the CSE course data. Start the faculty list (name, designation, NSU page, Scholar URL, ORCID, checked OpenAlex author ID). (Screens: `docs/screens.md`. Test cases: `docs/test-cases.md`, sections D and E. CSE data: `data/curricula/42-cse.json`, 130 credits. Faculty list started in `data/faculty/`: 87 ECE faculty with name, initials, designation and NSU page from the public department listing; Scholar, ORCID and OpenAlex IDs come in Phase O1.)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/grading.test.ts`: every grade point, best of several attempts, F then a pass, F only, I and W only, a waived course (credits, no CGPA), a non-credit course, the retake blocked at B+ and above, allowed below it, I and W never block, credits counted once.
- [x] `src/server/features/attempts/attempts.api.test.ts`: retake validation on create and edit, a mod gets 403 on another user's attempts and CGPA (implemented as 404: no route names another user, and another user's attempt id is not found).
- [x] Run: `vp test grading attempts`

### Test Gate 6

- [x] **Grading and attempt tests pass.**
- [x] **(Manual) A seeded student's CGPA on staging matches a hand calculation done by D.**

---

## Phase 7 — Moderation, reports & audit

**Owner:** Dev B · **When:** Sprint 2 · **Depends on:** Phase 2

**Goal:** Mods ban users, release ID conflicts, reset passwords, soft-delete content and handle reports. Admins manage mods and reverse any logged action from its snapshot.

> **Design decisions (locked in):**
>
> - Soft delete = `deleted_at` + `deleted_by`, through one `softDelete()` helper that writes an audit row with the before-snapshot and a reason. Hard deletion only happens in cron.
> - `reverse(auditId)` restores the snapshot (or un-bans) and writes its own audit row. Only admins can call it.
> - Reports are generic: `reports(target_type, target_id, reporter, reason, status)`. Each later post type adds **one enum value** to `target_type`. There is one open report per reporter per target, and report creation is rate-limited.
> - ID-conflict tool: a mod finds the account holding a 7-digit key and releases it (the holder is banned, or the key is cleared). Logged. This is the only screen where mods see a student ID.
> - Mod-assisted password reset: the mod issues a temporary password and `must_change_password` is set. Logged.
> - Mods cannot see attempts, CGPA or routine data.

### Checklist

- [x] `reports` table. `audit_log` gets an index on target and actor.
- [x] `softDelete()`, `reverse()` and the reversal rules for each action type (soft delete, ban, role change, key release).
- [x] Mod API: user list and search by username, ban and unban, ID-conflict release, temporary password reset, report list and resolve.
- [x] Admin API: promote and demote mods, the audit log list, reverse.
- [x] `POST /api/reports` (rate-limited).
- [x] Mod panel screens: users, reports queue (Phase 8 merges held posts into it), audit log with a reverse button (admin only).

### Checklist — Docs & QA (C, D)

- [x] C: moderation flow activity diagram. (`docs/moderation-flow.md`)
- [x] D: mod panel test cases (ban, reset, release, reverse). (`docs/test-cases.md`, section F)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/server/features/mod/mod.api.test.ts`: students get 403 on mod routes and mods get 403 on admin routes, every action writes an audit row with a snapshot, reverse restores the exact state and logs itself, a duplicate open report is refused, the temporary password forces a change, mods cannot read attempts (no mod route reads them, so another user's attempts are a 404; soft delete and its reversal are covered in `src/server/softDelete.api.test.ts`).
- [x] Run: `vp test mod`

### Test Gate 7

- [x] **Mod tests pass.**
- [x] **On staging, an admin reverses a ban and a soft delete, and both reversals appear in the audit log.**

---

## Phase 8 — Screening pipeline & review queue

**Owner:** Dev B · **When:** Sprint 2 · **Depends on:** Phase 5, Phase 7

**Goal:** One `screen()` function runs the deterministic rules and a stub model step, posts end up published, pending review or rejected, and mods clear held posts from the same queue as reports.

> **Justification:** Every post type calls `screen()` from its first commit, so a real model step (Clef, optional Phase O3) is a swap behind an interface and no feature code changes. Until then the stub model step stays.

> **Design decisions (locked in):**
>
> - **Chain of Responsibility:** rules → model step (interface; Phase 8 ships a stub that always approves) → verdict `approve | review | reject` with a reason category: prohibited item, personal data, scam or spam, abuse or harassment, off-topic, fine.
> - **Deterministic rules** (no AI): student IDs (the Phase 2 regex, applied after removing spaces and dashes inside digit runs), card-like numbers (13 to 19 digits that pass a Luhn check and are **not** a Bangladeshi phone number, so phone numbers in text are not flagged), links that fail the resource link rule (https only, a public site, no IP address, private name, login or port, no link shortener, at most 500 characters; a bare domain counts as https; changed 2026-11-12: same link rule as resource links), contact format, length limits, a banned-word list. A clear rule violation rejects without calling the model.
> - **Screened text:** rides (pickup, destination, notes), lost and found (title, description, place), marketplace (title, description), resource requests and submissions (notes). Contact fields, grades and the routine are never sent to the model.
> - **Statuses** on every post table: `published | pending_review | rejected`. A post in `pending_review` is visible only to its author ("Waiting for a moderator") and to mods, using one shared `visibleTo(user)` query filter. Rejected posts show a category-level reason only, never scores. The author can edit and resubmit, or tap "Ask a moderator to look" (which moves it to the queue).
> - **Fail safe:** a model error, a timeout or the daily cap means `pending_review`. Unscreened text is never auto-published and never auto-rejected. The rules still apply.
> - **Edits** that change screened text run the pipeline again.
> - **Probing:** 3 rejections in one hour mean a 1-hour posting cooldown and a flag on the user in the mod panel.
> - **Audit:** every automatic decision writes an audit row with actor `automod`, the model name, the category, the scores and a text snapshot.
> - A test-only flag forces `review`, so the queue can be exercised before Clef exists.
> - The mod's decision overrides the model. The author gets a `notify()` message on approve or reject.
> - **Images (added 2026-10-19, for post photos in Phases 12 and 13):** `screen()` input takes optional `images` (WebP bytes). The rules step treats a bad image (not WebP, too large, wrong dimensions, EXIF or XMP chunk) as a clear rule violation. The model step receives the images with the text. The stub model step returns `review` whenever images are present, so photos are never published unscreened.

### Checklist

- [x] `src/server/moderation/rules.ts` and `screen.ts` with a `ModelStep` interface and a `StubModelStep`.
- [x] Shared column set and helpers for moderation status. `visibleTo(user)` filter in the repo layer.
- [x] Probing counter through `rateLimit()`, and the mod-panel flag.
- [x] Mod queue: held posts and reports in one list, showing the text, the author's username, the model category and confidence, the rule flags, and the queue size at the top. Approve and reject actions notify the author.
- [x] Reject-reason messages from D, mapped per category.

### Checklist — Docs & QA (C, D)

- [x] C: post screening flow activity diagram. (`docs/screening-flow.md`)
- [x] D: write the reject-reason messages. (`docs/reject-reasons.md`, used by `src/shared/rejectReasons.ts`)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/server/moderation/rules.test.ts`: student IDs with and without spaces, a Luhn card number is caught, a BD phone number in text is not, a safe https link in text passes while a shortener, `http`, an IP address and a login in the address are flagged (changed 2026-11-12: same link rule as resource links), length limits, banned words, bad images.
- [x] `src/server/moderation/screen.test.ts`: a rule violation never calls the model step (spy), a stub approve publishes, the stub with images gives review, an invalid image is rejected by the rules, the forced flag gives review, a model error or timeout gives review, the audit row has actor `automod`. (The audit row and the daily cap need D1, so they are in `record.api.test.ts`.)
- [x] `src/server/moderation/queue.api.test.ts`: a pending post is hidden from other students, the mod decision overrides and notifies the author, 3 rejections trigger the cooldown, an edit is screened again.
- [x] Run: `vp test moderation`

### Test Gate 8

- [x] **Moderation tests pass.**
- [ ] **With the forced-review flag on staging, a test post appears in the mod queue, a mod approves it, and the author gets an inbox message.**

---

## Phase 9 — Class routine

**Owner:** Dev B · **When:** Sprint 2 · **Depends on:** Phase 4 (course list, terms)

**Goal:** Students enter their current-term sections, and Home shows today's classes while a full routine screen shows the week.

> **Design decisions (locked in):**
>
> - Entry: course (from the curriculum list), section number, days of the week, start and end time (Asia/Dhaka), room (free text), faculty initials (free text, as printed on the NSU routine, so this phase does not depend on the faculty table). The day picker uses the day letters printed on the NSU routine (D confirms them).
> - `routine_entries` keyed by user and term. Add, edit, delete, and clear a whole term.
> - An overlap on the same day **warns but does not block**.
> - Private: mods and admins cannot see it, and it is never used for notifications or shown to anyone else.
>   Note (2026-10-21): "cannot see it" means another user's routine. Mods and admins are students too and keep their own routine (reached from Home, since the Mod tab takes the Routine tab's place in the five-tab bar). No route reads another user's routine; another user's entry id is a 404.
> - `ceiling:` manual entry only. There is no import from NSU's portal, which keeps the app free of scraping and login sharing.
> - Look (added 2026-10-20, Phase 4b): Home's summary panel switches from degree standing to the next class. Today's classes are a list on a time rail, with the current class on a `brand-soft` row and finished classes in `faint` ink.
>   Note (2026-10-21): the full routine screen is a calendar with Month, Week (the default) and Day views instead of a plain week list. A term's dates come from `TERM_STARTS` for now; moderators will set each term's start and end in a later change (students never do).

### Checklist

- [x] `routine_entries` table and API (owner only).
- [x] `src/shared/routine.ts`: `overlaps(entries)`.
- [x] Home "Today" list (time order, Asia/Dhaka) with a link to the full routine. A full-week screen with "No classes" on empty days. An add/edit form showing the overlap warning.

### Checklist — Docs & QA (C, D)

- [x] D: routine screens and test cases. (Screens: `docs/screens.md`, Class routine. Test cases: `docs/test-cases.md`, section K. Requirements FR-61 to FR-66 in `docs/srs.md`; the NSU day letters S M T W R F A still need D's confirmation against a printed routine.)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/routine.test.ts`: overlap, touching end and start (no overlap), different days, "today" correct across UTC midnight.
- [x] `src/server/features/routine/routine.api.test.ts`: owner only, a mod gets 403, clear term. (Since 2026-10-21: a mod or admin keeps their own routine and gets 404 on a student's entry.)
- [x] Run: `vp test routine`

### Test Gate 9

- [x] **Routine tests pass.**
- [ ] **(Manual) On a phone, entries show on Home on the right weekday and in time order.**

**Sprint 2 milestone (Phases 5-9):** CGPA and retakes work end to end. Students can enter their routine and see today's classes on Home. Mods and admins can act, reverse actions and review held posts from the queue.

---

## Phase 9b — Grade planner & retake advisor

**Owner:** Dev A · **When:** Sprint 2, after Phase 9 and before Phase 10 · **Depends on:** Phase 4 (course map), Phase 6 (grading, attempts)

**Goal:** On a new Planner view in Courses, students set a target CGPA, try mock grades on past and future courses to see the CGPA they would get, and get advice on whether doing well in their remaining courses reaches the target or whether a few retakes are worth paying for.

> **Justification:** Retakes cost extra tuition, and students usually guess at the trade-off. All the data needed (attempts, the course map, the retake rule) already exists, so this is pure arithmetic on top of `grading.ts`, with no AI and one small table column.

> **Design decisions (locked in, 2026-11-02):**
>
> - **Where:** a third Courses view, **Planner** (`/courses?view=planner`), next to List and Roadmap. Unlike Roadmap it works on phones too: the view toggle shows List and Planner on phones and all three views from `md` up.
> - **Target CGPA:** saved to the account as `users.target_cgpa`, stored as integer hundredths (e.g. `350` for 3.50), nullable. The shared Zod schema accepts 0.01 to 4.00 in steps of 0.01; the server also refuses a target at or below the student's real CGPA (`target_not_above_current`). If the real CGPA later reaches the target, the planner shows it as reached rather than an error. Writes go through `rateLimit()`. Like attempts, the target is owner-only: no route reads another user's target, and mods and admins cannot read it.
> - **Mock grades** stay in the browser only (`localStorage`, keyed by username and curriculum version; `me` carries no id and usernames never change), with a "Clear mock grades" action. They are never sent to the server and never change real attempts, CGPA or retake badges anywhere else in the app. `ceiling:` mocks do not follow the student across devices. Revisit if students ask to keep plans on more than one device.
>   - On a **past** course, a mock is a hypothetical retake attempt and is offered only while `canRetake()` allows a retake. Best grade still counts, so a mock below the current best changes nothing (the row says so).
>   - On a **future** course (a slot with no graded attempt, including elective slots with no course picked yet, using the slot's credits), a mock is a hypothetical first attempt.
>   - Grades offered are the letter grades of `NSU_SCALE` only (no I, W or WV).
> - **Projected CGPA** = `cgpa()` over the real attempts plus the mocks, through the same `grading.ts` functions, so the planner can never disagree with the CGPA summary when there are no mocks.
> - **Horizon:** the rest of the degree. Remaining credits are the course map's unfinished, non-excluded, credit-bearing slots (degree required minus earned). A course with only an F is a remaining course: passing it replaces the F's grade points without adding to the graded credits, so the math works per course record, never on totals.
> - **Predicted grades** come from the student's own history (best grade per graded course; F counts, I/W/WV/non-credit/excluded don't; mock grades never count):
>   - **Overall:** the student's credit-weighted average so far, pulled toward `PLANNER_FALLBACK_AVERAGE` with `PLANNER_PRIOR_COURSES` courses of weight, so a new student starts near it and moves toward their own grades.
>   - **By category** (the course map category, e.g. General Education, Major Core): the student's average in that category, pulled toward the overall prediction the same way. A remaining course, or a retake, is predicted at its category's value, or the overall one when the category has no grades yet.
>   - **Ceiling:** the upper-quartile best grade, snapped down, or `PLANNER_FALLBACK_CEILING` with fewer than `PLANNER_HISTORY_MIN_COURSES` graded courses. It lifts only the best case: there each course scores the higher of its prediction and the ceiling, so the best case never falls below the prediction (2026-11-05).
>
>   The screen says what the predictions rest on ("Predicted from your grades by category (average 3.22)."), and that they are rough while history is thin ("Rough until you have 8 graded courses (2 so far). Best case assumes A-.", or "Predictions start at 8 graded courses (2 so far)." while it is too early). Nothing is editable.
>   Revised 2026-11-05: the first version compared the needed average with the ceiling grade, then with the median grade. Both told a student with A's in Core and D's in General Education (CGPA 3.22) that a 3.97 average over 81 credits needed no retakes: one grade from the whole history hides that grades differ by kind of course, and a needed average under the best grade is possible, not likely.
>
> - **Advice compares the predicted finish with the target.** Retakes cost extra, so the advisor suggests them only when the predicted finish falls short.
>   1. If no unmocked remaining credits are left and the projected CGPA (real grades plus mocks) meets the target: **reached**. With courses left, a CGPA at the target today is not enough: go to step 2.
>   - **Too early (2026-11-05):** with fewer than `PLANNER_HISTORY_MIN_COURSES` graded courses the predictions are mostly `PLANNER_FALLBACK_AVERAGE`, so while credits remain and straight A's could reach the target the outcome is **too early**: only the average the target needs, no prediction, no verdict and no retake. The Retakes tab still takes mock grades. A target straight A's can't reach is still **out of reach**, with no retakes listed: that is arithmetic, not a prediction. Steps 2 to 4 apply from the eighth graded course.
>   2. Predict the graduation CGPA with every unmocked remaining course at its predicted grade. If it meets the target: **no retakes**, with the predicted finish, the average the target needs in the remaining credits, and the student's usual average there.
>   3. Otherwise add retakes one at a time, greedily: a course is a candidate when `canRetake()` allows it, it is graded and credit-bearing, it has no mock, and its predicted grade, to the nearest scale grade, beats its best grade, so a retake never reads `B → B` (2026-11-05). A failed course outside the remaining ones, such as an extra course, is a candidate too. A waived course (its only pass is a waiver) is never one and has no row; a real pass wins over a waiver, so such a course stays a candidate. Pick the largest gain per credit (the grade points of the shown grade minus the current best); break ties by more credits, then course code. Stop as soon as the predicted finish meets the target. Show each retake with its current best and the likely grade (the prediction, to the nearest scale grade). If greedy fills `PLANNER_MAX_SUGGESTIONS` slots without meeting the target, suggest instead the smallest set that does: gains add, so the best set of k retakes is the k with the largest total gain (gain per credit times credits; ties by fewer credits, then code), and the smallest working k wins.
>   4. If no set of at most `PLANNER_MAX_SUGGESTIONS` retakes meets the target: **out of reach**, showing the predicted finish with the retakes that help most (by total gain, leaving out any that move the CGPA by less than `PLANNER_MIN_RETAKE_EFFECT`, 0.01; the finish counts only those listed; a retake that is what reaches the target in step 3 is kept however small), the best case (the higher of the prediction and the ceiling grade in every remaining course and every eligible retake), and `maxCgpa` (the scale's top grade in all of them). `possible` is `maxCgpa` meeting the target: true reads "a stretch" (needs grades well above the usual), false reads "out of reach by graduation". `tooManyRetakes` is set only when all the candidates together would meet it.
>   5. A required course whose only grade is F is not an optional retake: it has to be passed anyway, so it sits in the remaining credits, never in the suggested-retake list, and its predicted grade points are floored at the lowest passing grade's.
>   6. Advice `text` is one short sentence that does not restate the numbers the panel shows ("On track without retakes.", "Retaking 2 courses gets you there.", "A stretch: you'd need grades well above your usual.", "Out of reach by graduation.", "Needs more than 5 retakes."). `too_early` has no detail rows, so its sentence carries the needed average ("You need about a 3.50 average in your remaining 121 credits.").
>
>   Revised 2026-11-05: `reached` used to ignore the rest of the degree; "out of reach" used the student's ceiling grade, so it appeared when straight A's would reach the target (now `possible`); the greedy cap could miss a working set; an F-only course could be predicted below a pass.
>
> - The advisor is a pure function in `src/shared/planner.ts` (it runs in the client, like `grading.ts`, with no new read endpoint). It takes the scale and the retake policy as the existing **Strategy** objects. Planner constants (`PLANNER_HISTORY_MIN_COURSES`, `PLANNER_FALLBACK_AVERAGE`, `PLANNER_PRIOR_COURSES`, `PLANNER_FALLBACK_CEILING`, `PLANNER_MAX_SUGGESTIONS`, `PLANNER_MIN_RETAKE_EFFECT`) are defined in shared code and re-exported from `src/server/limits.ts` with `ceiling:` comments, like the other client-side limits.
> - All advice text is built by the planner code from fixed templates. It never says a grade is guaranteed; the screen carries one line: "Estimates only. Retake rules and fees are set by NSU."
> - No AI and no notifications: the planner never leaves the student's device except to save the target.

### Checklist — Target & advisor logic

- [x] Migration: `users.target_cgpa` (integer hundredths, nullable). Shared schema `targetCgpaInput` in `src/shared/schemas/`.
- [x] `GET` and `PUT /api/attempts/target` in the attempts feature, next to `/summary` (owner only, rate-limited, refuses a target at or below the real CGPA). The repo layer keeps it out of every mod and admin read.
- [x] `src/shared/planner.ts`: `realisticCeiling(records)`, `outlook(records)`, `projectedCgpa(records, mocks)`, `neededAverage(records, remaining, target)`, `adviseRetakes(...)` returning `too_early | no_retakes_needed | retakes_suggested | out_of_reach | reached`.
- [x] Planner constants in shared code, re-exported from `limits.ts` with `ceiling:` comments.

### Checklist — Planner view

- [x] `CourseViewToggle` gains Planner and shows on phones (List and Planner; Roadmap stays `md` and up).
- [x] Target CGPA field (shadcn form + React Hook Form + `targetCgpaInput`), with the current and projected CGPA side by side.
- [x] Course rows with a mock grade picker: past courses (retake mock, only when a retake is allowed) and future slots (first-attempt mock). Rows with a mock are marked; "Clear mock grades" resets them.
- [x] Advice panel: the outcome, the needed average in remaining credits, the suggested retakes (course, current best, grade to aim for, credits), the predicted finish, what the predictions rest on, and the "Estimates only" line.
- [x] (2026-11-05) Every graded course the CGPA counts has a row, each code keys one row at most (slots sharing a code use their own keys), and out-of-reach advice shows the best case and the straight-A figure. The badge says "At target today": the advice below it judges the predicted finish, so it may still suggest retakes.
- [x] (2026-11-05) One page, three tabs under the CGPA block: Advice, Retakes (worst grade first) and Upcoming, so retakes are not buried under every remaining course. A long list opens on its first 10 rows plus any row with a mock, with "Show all" for the rest.
- [x] Empty states: no course map, no graded courses yet (advice uses the fallback ceiling and says so), no target set.

### Checklist — Docs & QA (C, D)

- [x] C: planner activity diagram (target → needed average → no retakes / retakes / out of reach). SRS requirements for the planner (Flow: docs/planner-flow.md. Requirements FR-67 to FR-79 in docs/srs.md)
- [x] D: planner screens in `docs/screens.md` and test cases, including two hand-calculated scenarios (one reaches the target with no retakes, one needs retakes) (Screens: docs/screens.md, Grade planner. Test cases: docs/test-cases.md, section L)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/planner.test.ts`: projected CGPA equals `cgpa()` with no mocks; a mock below the best grade changes nothing; a mock on a course that can't be retaken is ignored; F-only course passed in the future replaces the F without growing graded credits; ceiling from history (upper quartile, snapped down) and the fallback below the minimum course count; predictions by category pulled toward the overall average, and the fallback with no history; no retakes when the predicted finish meets the target; a needed average under the ceiling but above the usual grades is not called reachable; retakes predicted from the course's category; greedy picks the largest gain per credit and stops as soon as the target fits; a required F-only course is never suggested as a retake; out of reach reports the predicted finish and the best case, as a stretch or as out of reach; a target already reached only when nothing remains (with courses left and a weak category ahead it reports the predicted finish); a stretch (`possible`) against an impossible target (`maxCgpa` below the target); greedy filling the cap with small courses falls back to the best total-gain set, at its smallest size; a remaining F-only course is predicted at least the lowest passing grade.
- [x] `src/server/features/attempts/target.api.test.ts`: owner can set and read it, a target at or below the real CGPA is refused, out-of-range values are refused, another user's target is never readable (404), the rate limit applies.
- [x] Run: `vp test planner target`

### Test Gate 9b

- [x] **Planner and target tests pass.**
- [ ] **(Manual) On a phone, D's two hand-calculated scenarios match the planner's projected CGPA and advice.**

---

## Phase 10 — Resource sharing

**Owner:** Dev A · **When:** Sprint 3 (Weeks 5-6) · **Depends on:** Phase 5, Phase 6, Phase 7, Phase 8

**Goal:** Students request materials by course and/or faculty, matching students are notified, others submit safe https links, and the requester accepts, rejects or reports them, with expiry and purge handled by cron.

> **Design decisions (locked in):**
>
> - Links only. `ceiling:` no file hosting. A link must be `https`, at most 500 characters, with no username, password or port, and its host must be a public DNS name (not an IP address, `localhost` or a private or reserved name). Known link shorteners (`bit.ly` and 12 others, listed in `URL_SHORTENER_HOSTS`) are refused. The rule is `src/shared/resourceUrl.ts`, used by the form and again by the server (changed 2026-11-12: any public https site, shorteners refused). `ceiling:` nothing scans the page behind a link; reports and mods cover bad ones.
> - A request needs a course, a faculty, or both. The notification goes to users with an attempt that matches **every field the request sets**, excluding the requester and banned users, through `notify()`. The requester is never told who was notified.
> - Several students can submit to one request, and the requester accepts one. The requester sees the uploader's username. Only the requester sees the link.
> - The requester sets the expiry. Cron hard-deletes expired open requests, and hard-deletes fulfilled requests 3 months after fulfilment. The UI says this clearly.
> - The new-account cooldown applies to submitting links. Request notes and submission notes go through `screen()`. Reports use `target_type` `resource_request` and `resource_submission`.
> - **Help others (added 2026-11-12):** the Materials screen has a Help others tab listing open requests for any course the student has recorded (any faculty), and faculty-only requests for a faculty they had. Same-faculty requests sort first and are tagged. Notifications are unchanged (exact match, at publish). The requester sees whether each link's sender took the same faculty. Links stay visible to the requester only, and the purge rules are unchanged.
> - This phase creates `src/server/cron.ts`: one `scheduled()` handler that runs a list of cleanup jobs, one function per table. Later phases add a job to the list and never edit another phase's job.

### Checklist

- [x] `resource_requests` and `resource_submissions` tables with moderation status, expiry and `fulfilled_at`. Indexes for the fan-out query (attempts by course and faculty).
- [x] Create request (screened, fan-out notify), list my requests, submit link (safe https link rule, cooldown, screened), accept, reject, report.
- [x] `cron.ts` with the two resource jobs. A cron trigger added in `wrangler.jsonc` for both environments.
- [x] Screens: new request, my requests with their submissions, submit to a request (reached from the notification), clear expiry and purge wording.
- [x] Help others (2026-11-12): `GET /api/resources/requests/helpable` (any faculty for a recorded course, faculty-only for a faculty the student had, same-faculty first, capped by `resourceHelpableMax`), a Help others tab on the Materials screen, and a same-faculty line on each link the requester sees. Indexes `resource_requests_course_idx` and `resource_requests_faculty_idx`.

### Checklist — Docs & QA (C, D)

- [x] C: resource flow sequence diagram, and SRS requirements for resource sharing (Flow: docs/resource-flow.md. Requirements FR-80 to FR-95 in docs/srs.md, navigation FR-96)
- [x] D: resource screens and test cases. ToS, disclaimer and takedown policy drafts (Screens: docs/screens.md, App flow and Materials. Test cases: docs/test-cases.md, sections M and N. Drafts: docs/legal-drafts.md)

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/resourceUrl.test.ts`: public https hosts accepted, http and other schemes, credentials, ports, IP and private hosts refused, every shortener refused (subdomains too, look-alikes not), length cap, international hosts shown as punycode.
- [x] `src/server/features/resources/resources.api.test.ts`: the fan-out matches the course, the faculty and both, the requester is excluded, only the requester sees the link, accepting one fulfils the request, the cooldown blocks new accounts, expiry filtering, the cron purge timing, a report on a submission reaches the queue.
- [x] Run: `vp test resources resourceUrl`

### Test Gate 10

- [x] **Resource tests pass.**
- [x] **On staging, request → notification → submit → accept works between two seeded students, and the link is hidden from the second one's view of other requests.**

---

## Phase 11 — Shared post kit & rides

**Owner:** Dev B (Dev A reviews) · **When:** Sprint 3 · **Depends on:** Phase 7, Phase 8

**Goal:** Students post one-off and recurring rides with seats, price and contacts, filter the feed, reveal contacts with rate limiting, and report rides, all built on a shared post kit that lost and found and marketplace reuse.

> **Design decisions (locked in) — shared post kit:**
>
> - **Contacts:** at least one of phone (`^\+8801[3-9]\d{8}$`), WhatsApp (`https://wa.me/…`), Messenger or Facebook (`https://m.me/…`, `https://facebook.com/…`). Validated in `src/shared/contact.ts` and shown by a shared `ContactInput`. Contacts are returned only by `GET /api/<type>/:id/contact`, which needs a login and is rate-limited through `rateLimit()`.
> - **Expiry and renewal:** one helper that computes `expires_at` and enforces each type's renewal rule. Feeds filter out expired rows in the query.
> - **Cleanup:** one cron job per table, added to `cron.ts`.
> - **Author delete (added 2026-10-19):** the author can delete their own ride, lost-and-found post or listing (`DELETE /api/<type>/:id`, behind a confirm dialog). It goes through `softDelete()` with the author as actor and reason `author`, so the post and its photos disappear for everyone at once and the usual audit row is written. The type's cron job hard-deletes the row and its photos after the author-delete purge window in `limits.ts` (start at 7 days), but skips a post with an open report until the report is resolved. Deleting at once would let a reported scam wipe its own evidence. Admin reversal does not apply to author deletes.
> - **Reports and mod removal:** one new `target_type` per table. `softDelete()` and `reverse()` from Phase 7.
> - **Screening:** `screen()` on create and edit. `visibleTo(user)` on every feed and detail query. `canPost()` cooldown on create.
>
> **Design decisions (locked in) — rides:**
>
> - Own `rides` table. Fields: a required pickup area and destination area (picked from the Dhaka areas list; an optional landmark for each, free text such as "north gate", screened) (changed 2026-11-12: areas replace free-text places), vehicle type (bike, car, SUV, bus), total seats, seats remaining, price per seat in taka, contacts, optional notes.
> - **One-off:** a departure date and time, and it expires at departure. **Recurring:** days of the week, a departure time and an end date (default 60 days out). The poster can renew. Check constraints enforce which fields each kind needs.
> - The poster can edit, change or reduce seats, or mark the ride fully booked. Seats remaining = 0 → status `full` automatically. `CHECK (seats_remaining BETWEEN 0 AND total_seats)`, and seat changes are one `UPDATE` statement, so there are no race conditions and the count never goes out of range.
> - Feed filters (Zod search params in the URL): pickup area (`from`), destination area (`to`; picking a broad area also matches its sub-areas), a text fallback over landmarks and area names, vehicle type, date or weekday. Paginated, with the filtered columns indexed.
> - **Areas (changed 2026-11-12):** a generic `areas` table (lost and found may reuse it) seeded with a list of Dhaka areas, Bashundhara R/A first (NSU is there) and "Outside Dhaka" last. No postal codes. Mods and admins add areas, rename them, add one level of sub-areas under a top-level area, and hide or show them with a reason (`hidden`, never deleted). A ride keeps an area that is hidden later; a new or edited ride can only pick visible areas (400 `invalid_area`). Every area action writes an audit row; rename, hide and show can be reversed from the audit log, adding cannot.
> - The platform does not arrange or guarantee rides. The ToS and an in-app notice say that students arrange rides and payment themselves.

### Checklist — Build order

- [x] **Shared kit:** `contact.ts`, `ContactInput`, the contact reveal endpoint pattern, the expiry helper, `ReportButton`, `StatusNote` ("Waiting for a moderator" and rejection reason with "Ask a moderator to look"), the author-delete endpoint pattern and `DeletePostButton`, the purge rule (window passed and no open report) used by every cron job.
- [x] **Step 1:** `rides` table, check constraints and indexes.
- [x] **Step 2:** create and edit API with contact validation and `screen()`. One-off rides first, then recurring.
- [x] **Step 3:** seat logic (single-statement update, auto `full` at 0).
- [x] **Step 4:** feed and filters, paginated, excluding expired rides in the query.
- [x] **Step 5:** expiry and renewal, and the ride cleanup job in `cron.ts`.
- [x] **Step 6:** screens: post a ride, edit, my rides, feed, detail with contact buttons (`tel:`, `wa.me`, `m.me`), safety notice.
- [x] **Step 7:** report a ride, mod removal, admin reversal (`target_type` `ride`).
- [x] **Areas (changed 2026-11-12):** `areas` table seeded with the Dhaka list (migration `0020_ride_areas`), rides take `pickup_area_id` and `destination_area_id` with optional landmarks, the feed filters by `from` and `to` (sub-areas included), `GET /api/areas`, mod area API (list, add, rename, hide, show) with audit rows and reversal.
- [x] **Areas screens:** ride form and feed filter area pickers, landmark fields, and the mod Areas screen (add, rename, sub-areas, hide and show).

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams for rides.
- [ ] D: ride screens. ToS ride-safety wording. Ride test cases. The auto-moderation calibration set only if Phase O3 is picked up.

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/contact.test.ts`: valid and invalid phone numbers, wa.me, m.me and facebook.com links, at least one required.
- [x] `src/server/features/rides/rides.api.test.ts`: seats never go below 0 or above the total, auto `full` at 0, one-off vs recurring validation, the default end date, renewal, the feed hides expired and pending rides, the contact reveal needs a login and hits its rate limit, the feed response has no contact fields, report + removal + reversal, edits are screened again, an author delete hides the ride at once, another user cannot delete it, the cron purges it after the window but not while a report is open.
- [x] `src/server/features/areas/areas.api.test.ts`: the seeded list (Bashundhara first, Outside Dhaka last), hidden areas listed to mods but not students, add, rename, hide and show by a mod with audit rows, students refused, a sub-area under a sub-area refused, a duplicate name refused, reversal of rename and hide. The ride tests also cover areas: both required, unknown or hidden refused, landmarks optional and screened, `from` and `to` filters with sub-areas, a ride keeping a later-hidden area, and the report label.
- [x] Run: `vp test contact rides`

### Test Gate 11

- [x] **Ride tests pass.**
- [ ] **(Manual) On a phone, post a recurring ride, filter by weekday, reveal the contact, and the WhatsApp and dialer links open the right app.**

**Sprint 3 milestone (end of Week 6):** resources and rides work on staging, and the shared post kit is ready for lost and found (12) and marketplace (13).

---

## Phase 11b — Ride map

**Owner:** Dev B · **When:** Weeks 6-7, after Phase 11 and before Phase 13 on Dev B's track · **Depends on:** Phase 3 (PWA shell), Phase 11 (rides and areas)

**Goal:** A Map view in Rides shows how many live rides leave from (or go to) each Dhaka area as pins on a calm, app-styled map. Tapping a pin opens the feed filtered to that area. It is a faster way to find a ride from a far area (Jurain, Jatrabari, Uttara) than scrolling the list.

> **Justification:** Rides come from all over the city, not only near NSU, and a list of area names doesn't show where things are. The area list from Phase 11 already gives every ride a place, so a map needs only one point per area. It needs no geocoding, no exact addresses and no paid service.

> **Design decisions (locked in, 2026-11-12):**
>
> - **Renderer:** MapLibre GL JS (open source, BSD-3). It is loaded with a dynamic `import()` only when the Map view opens, in its own chunk, so the rest of the app never downloads it. `ceiling:` about 200 KB gzipped for the map chunk. Revisit if the Map view becomes the default.
> - **Tiles, in two stages.** The tile source is one config value (`src/client/lib/map/source.ts`), so switching stages changes no screen code.
>   1. **Prototype:** OpenFreeMap vector tiles (OpenStreetMap data in the OpenMapTiles schema). They are free, need no API key and state no request limit.
>   2. **Release:** a self-hosted Protomaps `.pmtiles` extract of greater Dhaka, covering about Savar to Gazipur to Narayanganj. It lives in R2 and the Worker serves it at `/tiles/*` with HTTP range requests. No third party then sits in the request path, there is no key, and there is no bill at our traffic. The extract is built once by a script (`vp run map:extract`) and refreshed by hand when needed, not in CI. `ceiling:` one map open is about 20–60 tile requests; at a few hundred users a day that stays well inside the Workers free plan's 100,000 requests a day. Revisit if map traffic passes about a quarter of that.
>      Glyphs (label fonts) and the sprite follow the same two stages. Labels use Noto Sans glyphs: MapLibre needs prebuilt glyph files, and Figtree has none.
> - **Our own style, built from theme tokens.** The style JSON is generated at runtime by `buildMapStyle(tokens)` in `src/client/lib/map/style.ts`. It reads the active palette's CSS custom properties (`--app`, `--surface`, `--line`, `--ink`, `--soft`, the accent), so the map follows all five palettes and the Night palette with no hex values outside `src/client/index.css`. When the theme changes, the map restyles.
>   - **Look:** neutral land, soft tints for water and parks, roads as hairlines that thicken a little by road class, no buildings below street zoom, and no points of interest.
>   - **Labels:** major roads and area or neighbourhood names only. Labels prefer `name:en` and fall back to `name`.
>   - **Pins:** the accent color, carrying the ride count, with a soft shadow like the app's other floating layers. No gradients and no glass.
>   - Visual references such as Terraink posters are inspiration only. **No code or styles are copied from AGPL-3.0 projects.** A permissively licensed base (the OpenFreeMap or Protomaps base styles) may be the starting point, with its license kept in `THIRD_PARTY_NOTICES`.
> - **Attribution is required and always visible:** "© OpenStreetMap contributors" (and "OpenMapTiles" while their schema or tiles are used), as a compact control in a corner. It must stay readable in every palette.
> - **Area points:** `areas` gets nullable `lat` and `lng` (WGS84, 5 decimals, about 1 m) in a new migration.
>   - **Seeding:** the shipped list is seeded from OpenStreetMap place centers. A one-off offline script looks each area up and writes `data/areas/points.json` with the source noted. The script respects Nominatim's limit of one request a second, and the app never calls Nominatim.
>   - **Mod edits:** mods set or move an area's point on the Areas screen by dragging a pin on the same map. That writes an audit row and is reversible like a rename.
>   - **Validation:** a point must fall inside the greater-Dhaka bounds (`MAP_BOUNDS` in shared code, re-exported from `limits.ts` with a `ceiling:` comment). "Outside Dhaka" has no point.
>   - **Missing points:** an area without a point is not drawn. Its rides are counted in a "Not on the map: N rides" line under the map that opens the list.
> - **Counts endpoint:** `GET /api/rides/areas` returns `{ by: "pickup" | "destination", areas: [{ areaId, count }] }` for the live rides matching the current feed filters (vehicle, date, weekday; `q` is ignored).
>   - **Query:** one grouped query on the area and expiry indexes, applying the same visibility, expiry and deletion rules as the feed.
>   - **Response:** counts only. It never carries ride details, contacts or authors.
>   - **Sub-areas:** a sub-area with no point of its own is counted under its parent.
>   - **Limits:** login required, and rate-limited like the feed.
> - **Map view:** a List / Map toggle on the Rides feed (`/rides?view=map`), next to the existing filters, which apply to both views.
>   - **Pin direction:** a Leaving from / Going to switch picks whether pins count pickups or destinations.
>   - **Tapping a pin:** it opens a small sheet ("Jatrabari: 6 rides leaving"). Its button switches to the list filtered with `from` or `to` set to that area.
>   - **Bounds:** the map opens centred on Bashundhara R/A (NSU) at city zoom, and is held to `MAP_BOUNDS`.
>   - **Phone layout:** the map fills the content area above the floating tab bar.
> - **Privacy:** pins are area-level only. Exact pickup points are **not** collected in this phase. If students ask for them later, an exact pickup pin would be one more optional ride field, shown only after "Show contact" (same login and rate limit as the contact). Device location ("near me") is parked.
> - **No geocoding or address search in the app.** Students pick areas from the list or tap the map.
> - **Offline:** with self-hosted tiles, the service worker caches the style, glyphs and tiles CacheFirst with an entry cap (`mapTileCacheMax` in `limits.ts`, `ceiling:` about 30 MB). `/api` responses are never cached, as in Phase 3. With no network and nothing cached, the Map view says so and offers the list.
> - **Accessibility:** the list stays the primary view, and every map action can also be done there.
>   - Pins are real buttons labelled "Jatrabari, 6 rides", reachable by keyboard.
>   - The map has an accessible name.
>   - Reduced motion turns off fly-to animations.
>   - Pins and the attribution meet the contrast checks in every palette.
> - **Tests never hit the network:** MapLibre is mocked in component tests, and the tile source is a fake in API tests.

### Checklist — Build order

- [ ] **Step 1:** migration adding `areas.lat` and `areas.lng`, `data/areas/points.json` seeded from OSM by the offline script, `MAP_BOUNDS`, and a check that every seeded point is inside the bounds.
- [ ] **Step 2:** `GET /api/rides/areas` (grouped counts with the feed filters, pickup or destination, sub-areas rolled up, rate-limited), SQL in `src/server/repos/rides.ts`.
- [ ] **Step 3:** `buildMapStyle(tokens)` with light and Night output, the tile source config (OpenFreeMap first), attribution, and a lazy-loaded `RideMap` component.
- [ ] **Step 4:** the Map view on `/rides` (List / Map toggle, Leaving from / Going to, pins with counts, pin sheet that opens the filtered list, the "Not on the map" line, offline and error states).
- [ ] **Step 5:** mod Areas screen sets or moves an area's point by dragging a pin, with an audit row and reversal.
- [ ] **Step 6:** self-hosted tiles: `vp run map:extract` builds the Dhaka `.pmtiles`, the Worker serves `/tiles/*` from R2 with range requests, the source config switches to it, the service worker caches tiles within the cap, and `THIRD_PARTY_NOTICES` is updated.

### Checklist — Docs & QA (C, D)

- [ ] C: SRS requirements and a sequence diagram for the ride map (counts endpoint, pin tap to filtered list).
- [ ] D: map screens in every palette, test cases (pins, filters carried over, offline, keyboard and screen reader), and an attribution check.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/client/lib/map/style.test.ts`: the style is built from the given tokens, the Night tokens give the dark variant, labels prefer `name:en`, and the attribution text is present.
- [ ] `src/server/features/rides/rideAreas.api.test.ts`: counts respect the vehicle, date and weekday filters, exclude expired, held, rejected and deleted rides, roll sub-areas up into a parent, switch between pickup and destination, need a login, are rate-limited, and carry no ride details or contacts.
- [ ] `src/server/features/areas/areas.api.test.ts` (extended): points must be inside `MAP_BOUNDS`, a mod moves a point with an audit row, and the move can be reversed.
- [ ] `RideMap` component test with MapLibre mocked: a pin renders as a labelled button, tapping it opens the sheet, and the sheet opens the list with `from` or `to` set.
- [ ] Run: `vp test map rideAreas areas`

### Test Gate 11b

- [ ] **Map and counts tests pass.**
- [ ] **(Manual) On a phone, open Rides → Map in a light palette and in Night. The pins show the right counts for a date filter, a far-area pin (Jatrabari or Uttara) opens the filtered list, and the attribution is readable.**
- [ ] **(Manual) After Step 6, DevTools shows map tiles coming only from our own origin, and a second open with no network still draws the cached area.**

---

## Phase 12 — Lost and found

**Owner:** Dev A (Dev B reviews) · **When:** Weeks 6-7 · **Depends on:** Phase 11

**Goal:** Students post lost or found items, filter and search the feed, contact each other through the shared kit, and mark posts resolved. Found posts keep a private verification detail.

> **Design decisions (locked in):**
>
> - Type `lost | found`. Title, category (ID or card, wallet, phone, laptop or charger, bag, keys, books or notes, other), description, place (free text), date, contacts (shared kit), status `open | resolved`.
> - Found posts have an optional private **verification detail** that only the poster can see. It is never included in any other user's response.
> - **Photos (added 2026-10-19):** up to 3 per post through the post photos kit below, so owners, or friends who recognise the item, can identify it. **"ID or card" category:** photos are allowed, but the student ID or card number must be covered. The form says so above the picker, and every post in this category with photos goes to `pending_review` whatever the model says, so a mod checks that no number is readable before it is published. Ownership details are settled between the two users over the required contact method.
> - Student IDs and card numbers are rejected by the Phase 8 rules. The form warns about it up front.
> - Expires after 30 days, and the poster can renew once. Resolved or expired posts leave the feed and are hard-deleted 14 days later by cron.
> - Feed filters: type, category, place text, date, keyword.
> - **Possible match** (last item, first to cut): a new found post sends a `notify()` to the owners of open lost posts in the same category from the last 14 days. Nobody is told who else was notified.
> - The ToS says the app does not hold items or verify ownership. The post screen points to the campus security or lost-property office.
>
> **Design decisions (locked in) — post photos kit (added 2026-10-19; built here, reused by the marketplace in Phase 13):**
>
> - Optional, at most 3 photos per post (multiple angles). The first is the cover shown in the feed. Only WebP is ever stored. Rides have no photos.
> - **Encoding in the browser:** the client resizes each photo so its longest side is at most the max side in `limits.ts` (start at 1600px) and encodes WebP at quality 0.8. Re-encoding through a canvas drops EXIF, including GPS. If `canvas.toBlob(..., "image/webp")` returns a blob that is not WebP (some Safari versions fall back to PNG), the client uses a WASM WebP encoder (`@jsquash/webp`) instead. The server never converts images: Workers Free allows 10 ms CPU per request.
> - **Server checks (never trust the client):** create and edit are one multipart request carrying the fields and the photos, so a photo never exists without its post. `src/shared/webp.ts` accepts only RIFF/WEBP files within the byte limit and dimension limits read from the header, with no `EXIF` or `XMP ` chunk. The client uses the same parser to check its own output. A bad file is a field error, returned before R2 or Clef is touched.
> - **Screening:** photos go through `screen()` with the text (Phase 8 image hook; Phase O3 photo questions if it ships). Without Clef, every post with photos goes to `pending_review`, so a mod sees each photo before it is published. Edits that add, remove or reorder photos are screened again.
> - **Storage:** private R2 bucket per environment, binding `POST_PHOTOS`. Keys are `<target_type>/<postId>/<random>.webp`. The post ID is generated in the Worker before the insert. Objects are written first, then the D1 rows. If the D1 write fails, the request deletes the objects it wrote. One `post_photos` table (target type, target ID, key, position, width, height, bytes), indexed on target type + target ID, holds the keys for every post type. Photos removed in an edit are deleted from R2 after the D1 update. `ceiling:` a Worker killed between the R2 write and the D1 write leaves an orphan object. The key prefix makes a later sweep possible. Revisit if the bucket size drifts from the sum of `bytes`.
> - **Serving:** `GET /api/photos/:key` looks up the row, applies `visibleTo(user)` to its post and streams the object with `Cache-Control: private, max-age=<limits.ts>, immutable`. A key never gets new content, so long caching is safe. The bucket has no public access, no `r2.dev` URL and no custom domain, so photos of a hidden or deleted post stop loading for anyone who has not cached them. Mods see photos in the queue through the same endpoint. `ceiling:` every uncached photo is one Worker request against the 100,000/day free limit, and feeds load full-size covers (no thumbnails). Revisit if photo requests pass about 30% of daily requests or users report heavy data use.
> - **Cleanup:** mod removal and author delete stay soft deletes. The objects stay until the purge, so a mod reversal restores the photos. Each type's cron job deletes a post's R2 objects through the kit (one batched `delete()` per run, at most 1,000 keys) before its rows, so a failed run retries next time instead of losing the keys.
> - **Caps** in `limits.ts`: photos per post, bytes per photo, max side, a per-user daily upload cap (`rateLimit()`) and a global daily upload cap. Workers and D1 fail when over their free limits, but R2 bills the card, so these caps are the spending limit.

### Checklist — Photo setup (one-time)

- [ ] Enable R2 on the Cloudflare account (dashboard → R2 → "Add R2 subscription"). It needs a payment method. Nothing is charged within the free tier.
- [ ] Turn on a usage-based billing notification in the dashboard so any R2 charge is noticed.
- [ ] Add `r2:create:staging` and `r2:create:prod` scripts (`wrangler r2 bucket create unilink-photos-staging` / `unilink-photos-prod`) and run each once with `vp run`. Leave public access, the `r2.dev` URL and custom domains off.
- [ ] `wrangler.jsonc`: `r2_buckets` with binding `POST_PHOTOS` at the top level (local dev and tests; Wrangler simulates it locally, so no real bucket) and in each env with its bucket name, since bindings are not inherited. Then `vp run cf:types`.
- [ ] `vp add @jsquash/webp`. No secrets are needed: the binding is the credential.

### Checklist — Build order

- [ ] **Photos kit:** `src/shared/webp.ts`, the photo caps in `limits.ts`, the `post_photos` table, `src/client/lib/imageEncode.ts` (resize, WebP encode, `blob.type` check with the WASM fallback), a shared `PhotoPicker` (add, remove, reorder, inline errors) and `PhotoGallery`, the multipart parsing and R2-then-D1 write helper with rollback, `screen()` with images, `GET /api/photos/:key`, the purge helper for cron jobs. Update `docs/api-contracts.md`.
- [ ] **Step 1:** `lost_found_posts` table with check constraints and indexes on category, status and expiry.
- [ ] **Step 2:** create, edit, resolve, renew (once), author delete, with photos, using the shared kit, the photos kit, `screen()` and `canPost()`. "ID or card" posts with photos always go to review.
- [ ] **Step 3:** confirm the ID and card rules fire for lost-and-found text, and add the form warning.
- [ ] **Step 4:** feed, filters and search, excluding expired and resolved posts in the query.
- [ ] **Step 5:** cleanup job in `cron.ts` (14 days after expiry or resolution, the author-delete window, photos before rows).
- [ ] **Step 6:** screens: post, edit, my posts, feed with covers, detail with photos and contact buttons, verification detail field, the "cover the ID or card number" note on the picker, lost-property pointer.
- [ ] **Step 7:** report, mod removal, reversal (`target_type` `lost_found`).
- [ ] **Step 8:** possible-match notification.

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams.
- [ ] D: screens (early Week 7), ID-number warning wording, test cases.
- [ ] D: photo rules in the ToS and post forms (no documents or people's faces; on IDs and cards, cover the number). Privacy note: location data is removed from photos.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/webp.test.ts`: accepts a valid WebP, rejects PNG and JPEG bytes, a file over the byte limit, dimensions over the limit, and a WebP with an `EXIF` or `XMP ` chunk.
- [ ] `src/server/features/photos/photos.api.test.ts` (local R2): a fourth photo is refused, a non-WebP upload never reaches R2 or the model step, photos with the stub give `pending_review`, a failed D1 write leaves no object, an edit that removes a photo deletes its object, a hidden, pending or author-deleted post's photo returns 404 to another student but loads for a mod, the upload caps apply, the purge deletes objects before rows.
- [ ] `src/server/features/lostfound/lostfound.api.test.ts`: an ID number in the text is rejected, photos on an "ID or card" post go to `pending_review` even when the model approves, the verification detail is never returned to a non-owner (feed, detail and contact endpoints), renewal allowed once, resolve hides the post, author delete, the cron timing, report + removal, the possible match notifies the right users and not the poster.
- [ ] Run: `vp test lostfound photos webp`

### Test Gate 12

- [ ] **Lost-and-found and photo tests pass.**
- [ ] **(Manual) A found post triggers a possible-match notification for a seeded lost post on staging.**
- [ ] **(Manual) On staging, post with photos from an iPhone (Safari) and an Android phone. The stored objects are WebP, a downloaded photo has no location data, and the photos stop loading for another account after the author deletes the post.**

---

## Phase 13 — Marketplace

**Owner:** Dev B (Dev A reviews) · **When:** Week 7 · **Depends on:** Phase 11, Phase 12 (post photos kit)

**Goal:** Students list second-hand items with price, condition and contacts, filter the feed, and mark listings sold, within the 10-active-listing limit.

> **Design decisions (locked in):**
>
> - Title, category (books, electronics, calculators and lab gear, room and furniture, clothing, other), description, condition (new, like new, good, fair), price in taka or free, a negotiable flag, pickup area, contacts (shared kit), status `active | sold`.
> - Expires after 60 days, and the seller can renew. Sold or expired listings leave the feed and are hard-deleted 30 days later by cron.
> - At most 10 active listings per user. The new-account cooldown applies.
> - Feed filters: category, price range, condition, keyword.
> - Prohibited items (ToS and post form): weapons, drugs, alcohol, tobacco, exam papers or answers, pirated or copied material, university property, anything illegal in Bangladesh.
> - The app does not handle payment, delivery or disputes. An in-app notice says to meet in public places on campus and inspect items before paying.
> - **Photos (added 2026-10-19):** up to 3 per listing through the post photos kit from Phase 12 (`target_type` `listing`). The cover shows in the feed.

### Checklist — Build order

- [ ] **Step 1:** `marketplace_listings` table with check constraints on price and status, and indexes on category, status and expiry.
- [ ] **Step 2:** create, edit, mark sold, renew, author delete, with photos, using the shared kit, the photos kit, `screen()`, `canPost()` and the active-listing limit.
- [ ] **Step 3:** feed and filters, excluding sold and expired listings in the query.
- [ ] **Step 4:** cleanup job in `cron.ts` (30 days after sold or expiry, the author-delete window, photos before rows).
- [ ] **Step 5:** screens: post, edit, my listings, feed with covers, detail with photos and contact buttons, prohibited-items list, meet-in-public notice.
- [ ] **Step 6:** report, mod removal, reversal (`target_type` `listing`).

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams.
- [ ] D: screens, prohibited-items text, test cases.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/market/market.api.test.ts`: the 11th active listing is refused, price and condition validation, free listings, mark sold hides the listing, renew, photos attach and show on the detail, author delete, the cron timing, report + removal + reversal.
- [ ] Run: `vp test market`

### Test Gate 13

- [ ] **Marketplace tests pass.**
- [ ] **(Manual) Post, filter by price range, and mark sold on a phone on staging.**
- [ ] **(Manual) On staging, post a listing with 3 photos, reorder them, and the photos stop loading for another account after a mod removes the listing.**

---

## Phase 13b — Help & contact admins

**Owner:** Dev A (Dev B reviews) · **When:** Week 7, after Phase 12 · **Depends on:** Phase 2, Phase 5, Phase 7

**Goal:** Students get a proper Help screen that answers the common questions, and a Contact admins flow where they leave their own email and describe an issue. The issue reaches every admin's inbox, and an admin can reply (sharing their own email if they choose) and continue the conversation with the student inside the app.

> **Design decisions (locked in):**
>
> - **Help screen** (`/help`, reached from Settings and the rail or tab-bar overflow): short, static sections on the course map and attempts, CGPA and the planner, the routine, Materials (requests, Help others, links), reports and moderation, bans and appeals, privacy, and installing the app. Content lives in one typed file in `src/client/`, not the database. Ends with a Contact admins entry.
> - **Contact admins** is for signed-in users only. Logged-out and banned users keep the `ADMIN_CONTACT_EMAIL` mailto shown at login. `ceiling:` no public form, because without email verification it would be an open spam channel. Revisit if email verification ships.
> - **Ticket form** (shadcn form + RHF + a shared Zod schema in `src/shared/schemas/support.ts`): the student's own contact email (required, validated, max length in `limits.ts`), a category (account or login, ban or removed content, wrong course or curriculum data, bug, other), a subject and a message. The email is what the student typed. It is not taken from the account or checked by sending mail.
> - **Delivery:** creating a ticket calls `notify()` for every admin (type `support_ticket`). As with every notification, the payload holds only the ticket id: no email, no message text, no username. Admins open the ticket from the inbox or from a Support tab in the mod panel (`/mod/support`, admin only, not mods).
> - **Thread:** a ticket is a conversation of messages between the student and admins, shown in the app on both sides (the student under Help → My tickets). An admin reply may include the admin's own contact email, entered per reply (an opt-in field, never pre-filled from the account), so the conversation can move to email if needed. Each new message notifies the other side through `notify()` (`support_reply` to the student, `support_ticket` to all admins for a student follow-up). The student sees "UniLink admin", not the admin's username, unless the admin added an email.
> - **Status:** `open | answered | closed`. An admin reply sets `answered`, a student follow-up sets `open`, and an admin or the student can close it. A closed ticket is read-only, and the student opens a new one instead. Closing by an admin writes an audit row.
> - **Privacy:** the student's email and messages are visible only to that student and to admins. The admin's email is visible only to that ticket's student. No contact detail ever appears in a notification payload, push text, feed, or audit snapshot (the snapshot keeps ids and status only). Ticket text is never sent to an AI service.
> - **Abuse limits** (all in `limits.ts`, checked server-side through `rateLimit()`): at most N open tickets per student, a per-hour message cap per student, and maximum lengths for the subject and message. Messages go through the `screen()` rules step (links, spam), so a rule hit is refused with the usual reason and is not held for a mod.
> - **Retention:** cron hard-deletes closed tickets and their messages a fixed number of days after closing (`supportClosedPurgeDays` in `limits.ts`). Open tickets are never purged. The Help screen says this.
> - `ceiling:` no outbound email. The app never sends mail, and email addresses are shown in the thread for people to use by hand. Revisit if an email provider is added for verification.

### Checklist — Build order

- [ ] **Step 1:** `support_tickets` (author, contact email, category, subject, status, `created_at`, `updated_at`, `closed_at`) and `support_messages` (ticket, sender role student/admin, sender id, body, optional admin contact email, `created_at`), with indexes on (author, status), (status, `updated_at`) and (ticket, `created_at`). Repos in `src/server/repos/support.ts`.
- [ ] **Step 2:** shared schemas and limits. Notification types `support_ticket` and `support_reply` with shared copy and inbox deep links (student → the ticket under Help, admin → `/mod/support/$id`).
- [ ] **Step 3:** student API: create ticket, list my tickets, read one, follow up, close. Admin API: list by status (paginated), read, reply (with optional email), close (audited).
- [ ] **Step 4:** cron job to purge closed tickets after `supportClosedPurgeDays`.
- [ ] **Step 5:** screens: Help (sections plus Contact admins entry), contact form, My tickets list and thread, and the admin Support tab with list, thread and reply form. Mobile-first, Pocket Planner.

### Checklist — Docs & QA (C, D)

- [ ] C: SRS requirements and a sequence diagram for the contact flow.
- [ ] D: Help copy, screens, test cases, and a privacy note line on where support emails are visible.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/support/support.api.test.ts`: a ticket notifies every admin and no mod, the notification payload has no email or text, a mod and another student cannot read the ticket, an admin reply notifies the student and shows the admin email only when given, a follow-up reopens the ticket, closed tickets refuse messages, the open-ticket and message caps, the purge timing.
- [ ] Run: `vp test support`

### Test Gate 13b

- [ ] **Support tests pass.**
- [ ] **(Manual) On staging, a student files a ticket, an admin replies with their email, the student follows up, and the admin closes it, each step showing in the other side's inbox on a phone.**

---

## Phase 14 — Hardening & release

**Owner:** Dev B (lead), Dev A (bug fixes) · **When:** Week 8 · **Depends on:** Phases 1 to 13 (or their cut fallbacks). Not the optional phases.

**Goal:** Production is live from a tag, a rollback has been rehearsed, and every cross-cutting rule (limits, moderation on every post type, privacy, themes, PWA) is checked against the real app.

> **Design decisions (locked in):**
>
> - Production deploys only by tag, with a changelog entry. Migrations run before the deploy and stay backward compatible for one release. Export D1 (or note the D1 Time Travel point) before any production migration.
> - Rollback = redeploy the previous Worker version. The PWA ships inside the Worker, so the app and the API roll back together. Hashed assets and network-first `index.html` mean users get the rollback on their next launch.

### Checklist

- [ ] Every write route has a `rateLimit()` (signup, login, every post create, reports, contact reveal, support tickets and messages). List them in `limits.ts` comments.
- [ ] Reports, mod removal and admin reversal confirmed for resource submissions, rides, lost and found, and marketplace listings.
- [ ] Hard-coded color search is clean. D has checked the key screens (Home, course map, feeds, forms, mod panel) in every palette at phone width.
- [ ] Re-check the R2 prices and the Workers and D1 limits. Set the production caps. Confirm the R2 billing notification is on.
- [ ] Confirm the review queue keeps up without a model step: every post with photos waits for a mod, so check the number of mods and their turnaround (Open decisions).
- [ ] Privacy note in the app. The release sends nothing to an AI service; if an optional AI phase ships later, the note says what it receives (never usernames or IDs).
- [ ] Lighthouse PWA audit passes.
- [ ] Production migration, then `vp run deploy:prod` from a tag. Admin seeded in production and password changed.
- [ ] Rollback rehearsal: deploy tag N+1 to staging, roll back to N, confirm the app and API both revert and the installed app picks up the change.

### Test Gate 14

- [ ] **CI is green on the release tag, and production `/api/health` is OK.**
- [ ] **(Manual) The rollback rehearsal succeeded and was written down.**
- [ ] **(Manual) The full cross-type report, removal and reversal check passed.**

---

## Phase 15 — Delivery: documents, full test run & demo

**Owner:** C, D, All · **When:** Week 8 · **Depends on:** Phase 14

**Goal:** The final SRS, design report, diagrams and manual test report match what shipped, and the team has done two demo dry runs on an installed phone.

### Checklist

- [ ] C: final SRS (functional and non-functional requirements, including PWA install, offline shell and responsive behaviour, the societal impact section, survey results) and design report (SOLID, coupling and cohesion, and the patterns: **Composite** prereqs, **Strategy** grading and retakes, **Observer** `notify()`, **Repository** layer, **Chain of Responsibility** `screen()`, **Adapter** clients).
- [ ] C: use case, class, sequence and activity diagrams updated to the shipped build.
- [ ] D: full manual test run linked to requirement IDs, including Banglish posts, install and update on Android and iOS, every palette, and no theme flash on reload. Defect report.
- [ ] D: demo script. Final ToS, takedown policy, disclaimer and "unofficial student-run app" wording.
- [ ] All: two demo dry runs on an installed phone. Final release tag.

**Course outcome mapping:** CO1 Requirements (20%) → SRS + survey. CO2 OO design (30%) → diagrams + design report. CO3 Implementation (30%) → the one-Worker PWA, API, D1 and cron, the shared moderation flow, web push behind an adapter with a fake (plus Clef, OpenAlex and DeepSeek if the optional phases ship), and the live demo on an installed phone. CO4 Testing (20%) → unit, API and manual tests linked to SRS IDs.

### Test Gate 15

- [ ] **(Manual) Every SRS requirement ID has a test case, and the final run's defect report is published.**
- [ ] **(Manual) Two dry runs were completed, and the release is tagged.**

---

## Optional phases (may never ship)

Faculty research profiles and the AI supervisor finder were moved here on 2026-11-12 (they were Phases 11 and 13), and Clef auto-moderation later the same day (it was Phase 14). They are not part of the release, nothing in Phases 0 to 15 depends on them, and they may never be built. They keep their locked decisions so they can be picked up later without re-planning. The faculty directory the attempt picker and resource requests use (Phase 6, mod-managed) is already built and is not affected. Any of them runs after Phase 14, with Phase 14's checks repeated for what it adds. O3 stands alone; O2 needs O1, and its gate needs O3's `ClefClient`.

---

## Phase O1 — Faculty profiles & research sync

**Owner:** Dev A · **When:** after the release, if at all · **Depends on:** Phase 6 (faculty table), Phase 7 (report, hide)

**Goal:** Every CSE faculty member in scope has a profile with verified papers, an AI summary built only from fetched JSON, topic tags and a Scholar link, and students can keyword-search them.

> **Justification:** Profiles and keyword search stand on their own, so this phase can ship without Phase O2.

> **Design decisions (locked in):**
>
> - **No scraping.** Google Scholar is link-out only. The AI never browses. Our code calls structured JSON APIs: **OpenAlex** (primary, works by ORCID or author ID, abstract rebuilt from its inverted index), **ORCID** `/works` (cross-check and fallback, no abstracts), **Crossref** by DOI (optional, for a missing abstract or venue), and as a last resort a **manual list** D pastes into an admin form.
> - **Identity check** is done by hand, once per person (D): ORCID and OpenAlex author ID checked against their Scholar and NSU pages. People without an ORCID are matched by name and affiliation and verified by hand.
> - **Sync script** runs on a developer machine (`vp run faculty:sync`), not in the Worker. For each person: works from the last 5 to 8 years, at most 15, deduped by DOI, each trimmed to title, year, venue, the first 600 characters of the abstract and the top topics. Then one DeepSeek call: a summary of about 120 words + 5 to 8 tags, using **only** the supplied records, returned as JSON and validated with Zod. Saved through an admin-only route. The script logs in as an admin with credentials from local env. The trimmed input is stored next to the summary, so a mod can see what it was based on.
> - **Thin data:** fewer than 3 usable papers → `limited_data`. The summary uses the manual list or interests entered by D, and the matcher is told the data is thin.
> - **Profile page:** name, designation, department, photo link, public contact link, tags, AI summary, 5 to 10 recent papers (title, year, venue, link), Scholar link. The label "AI-generated from public publication records, may be incomplete or out of date", and a "Report a problem" button (`target_type` `faculty`).
> - Mods can hide a profile (logged). Hidden profiles never appear in lists, search or matches. Faculty can ask for correction or removal through the takedown policy.
> - Keyword search is a plain `LIKE` over name, summary and tags. About 100 rows does not need full-text search.
> - Refresh once a semester, or when a mod flags a profile.

### Checklist — Build order

- [ ] **Step 1:** extend `faculty` (slug, photo link, Scholar URL, ORCID, OpenAlex ID, tags, summary, summary date, sync input JSON, `limited_data`) and add `faculty_papers`. `department`, optional `initials`, `nsu_page` and `hidden` already exist (faculty directory, 2026-10-20), as does the mod hide/show with its audit row; the profile screens reuse that flag. Seed from D's verified list.
- [ ] **Step 2:** adapters + fakes: `OpenAlexClient` (check the current access terms and whether a free key or `mailto` is required), `OrcidClient`, `CrossrefClient`. Rebuild abstracts, merge and dedupe by DOI, handle missing abstracts.
- [ ] **Step 3:** `scripts/faculty-sync.ts` with the `DeepSeekClient` adapter (summary mode) and Zod validation. Admin-only `PUT /api/admin/faculty/:id/summary`. Admin form for the manual paper list.
- [ ] **Step 4:** faculty list, profile page, keyword search, report button, mod hide.

### Checklist — Docs & QA (C, D)

- [ ] D: finish and verify the faculty list. Faculty screens. AI label wording. Takedown policy including profile corrections. Read a sample of generated summaries against the real papers.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/adapters/openalex.test.ts`: inverted-index abstract rebuild, missing abstract, DOI dedupe across OpenAlex and ORCID, the 15-work and year window, 600-character trim.
- [ ] `scripts/faculty-sync.test.ts` (fake clients): invalid summary JSON is rejected, fewer than 3 papers sets `limited_data`, the trimmed input is saved.
- [ ] `src/server/features/faculty/faculty.api.test.ts`: hidden profiles are excluded from the list and search, the summary route is admin only, a report reaches the queue.
- [ ] Run: `vp test openalex faculty`

### Test Gate O1

- [ ] **Faculty tests pass with fakes, and no test touches the network.**
- [ ] **(Manual) A real sync has run for the full faculty list on staging. D has checked a sample against Scholar. Keyword search finds people by topic.**

---

## Phase O2 — AI matching & supervisor finder chat

**Owner:** Dev A · **When:** after the release, if at all · **Depends on:** Phase O1, Phase O3 (`ClefClient`, for the gate)

**Goal:** A student describes their interests in a chat and gets up to 5 real faculty suggestions with one-line reasons, from one stateless, validated, rate-limited DeepSeek call per message.

> **Design decisions (locked in):**
>
> - Input: interest text (at most 500 characters) and an optional course (CSE299, CSE499, CSE498R). The Worker sends the text and **all visible faculty summaries and tags** in one call: a stable prefix with the faculty block first and the student's text last (for DeepSeek context caching). It asks for JSON: top 5 faculty IDs, a one-line reason each, the matching topics. `limited_data` people are marked as such in the block.
> - Zod-validate the output, drop unknown or hidden faculty IDs, and retry once on invalid output. The model cannot invent a person.
> - **Each message is one independent call.** Earlier turns are never sent. The thread lives only in client memory and is lost on reload. Nothing is stored on the server, and no username or ID is sent.
> - The reply text is **built by the server** from the validated JSON ("Suggested based on published work: 1. …") with result cards (initials, name, designation, tags, "View profile"). No matches → a fixed reply with example keywords.
> - Limits: 10 matches per user per day and a global daily cap, both checked before the call (`limits.ts`).
> - UI: a popup on desktop and a full-screen chat on mobile, sharing one in-memory thread. A greeting and quick-prompt chips ("ML for CSE499", "Databases", "Networks & security", "Algorithms"). The footer says "suggested from published work". Results never claim that a faculty member is taking students, and the chat tells students to contact faculty through official channels.
> - **Fallback if the chat UI slips:** a single interest box with a results list, using the same endpoint.
> - **Finder gate:** cheap checks first (empty, over 500 characters, symbols only), then one Clef decision (needs Phase O3's `ClefClient`): relevant / too vague / off-topic / abusive or instruction attempt. Only "relevant" goes on to DeepSeek. The others get fixed server-written replies, and "too vague" has its own reply that suggests topics. Chips skip the gate. The gate sees only the message, never the faculty list. Gate limit: 30 per user per day. If Clef is down or capped, the message goes to the match step, where the normal limits apply. Only messages that pass the gate count toward the 10-per-day match limit. `note:` the gate saves money but is not a security boundary. The match call still treats the text as data.

### Checklist — Build order

- [ ] **Step 1:** `POST /api/finder/match`: limits, prompt builder, `DeepSeekClient` (match mode), validation, ID filter, one retry, server-built reply.
- [ ] **Step 2:** chat UI (greeting, chips, 500-character input, cards, fallback reply, footer note). Popup and full-screen layouts sharing state.
- [ ] **Step 3:** finder gate in front of `/api/finder/match` (Phase O3's `ClefClient`).
- [ ] **Step 4:** tests with the fake DeepSeek and Clef clients.

### Checklist — Docs & QA (C, D)

- [ ] C: faculty matching sequence diagram, including the chat message round trip.
- [ ] D: finder test cases (chips, limits, no-match reply, mobile and desktop).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/finder/match.api.test.ts`: malformed JSON → one retry → fixed reply, unknown and hidden IDs are dropped, per-user and global limits are checked before the client is called (spy), empty and over-length input, only the current message is in the prompt, the prompt contains no username or ID, nothing is written to D1 except rate-limit counters.
- [ ] `src/server/features/finder/gate.api.test.ts`: only "relevant" reaches DeepSeek (spy), each other class returns its fixed reply, chips skip the gate, the gate limit applies, a Clef failure falls through to the match limits.
- [ ] Run: `vp test finder gate`

### Test Gate O2

- [ ] **Finder and gate tests pass.**
- [ ] **(Manual) On staging, the chips and a free-text interest give sensible suggestions with working profile links on phone and desktop.**

---

## Phase O3 — Clef auto-moderation

**Owner:** Dev A (thresholds with D) · **When:** after the release, if at all · **Depends on:** Phase 8, Phase 12 (post photos kit, for the photo questions), D's calibration set

**Goal:** The stub model step is replaced by Clef-flash with thresholds tuned on a labelled set, so clear posts publish or are rejected on their own and only the uncertain band reaches a mod.

> **Note (2026-11-12):** optional. The release runs without it (see "Without this phase" below). The finder gate that used to live here moved to Phase O2.

> **Design decisions (locked in):**
>
> - `ClefClient` adapter on the `AI` binding with a timeout and a daily cap. Any failure → `pending_review` (the fail safe from Phase 8). Default model `@cf/cloudflare/clef-flash`. Switch to `@cf/cloudflare/clef` only if calibration shows Clef-flash cannot meet the target.
> - Two thresholds, both from calibration and never guessed: auto-reject needs a high score on a clear category, auto-approve needs a high score on "fine", and everything in between goes to a human. The target is a very low false-reject rate (the exact number is an Open decision). The review band is kept narrow so the mod queue stays manageable.
> - Students write English, Bangla and Banglish. The calibration set (about 150 examples: allowed posts, each prohibited category, personal data, spam, Banglish) covers all three, and uncertain results go to humans.
> - The model sees only post text, never usernames or IDs.
> - **Photos (added 2026-10-19):** post photos go to Clef-flash in the same call as the text, as image bytes (Clef does not accept URLs), never with filenames or metadata. Extra questions: does a photo show a readable ID or card number, a phone number or other personal data (→ personal data; on "ID or card" lost-and-found posts this goes to review, never auto-reject, since those posts are always reviewed), nudity or violence (→ abuse), or a prohibited item (→ prohibited item). The same two thresholds apply. Cost: about 1,030 input tokens per photo (one token per 32×32 block, capped at 1,024, plus 3), so a 3-photo post is about 11 Neurons.
> - **Without this phase:** the stub model step stays, so posts publish straight after the rules step, posts with photos always go to `pending_review`, and the report flow covers the rest.

### Checklist — Build order

- [ ] **Step 1:** `ClefClient` + fake. Confirm the exact call format on the model page, including how image bytes are passed in `images`. Wire it in as the `ModelStep` behind the existing interface.
- [ ] **Step 2:** calibration runner script (`vp run moderation:calibrate`): runs the labelled set and reports the false-reject rate, the false-approve rate and the share sent to review at the candidate thresholds. Lock the chosen thresholds in `limits.ts` and record them here: `________`.
- [ ] **Step 3:** tests with the fake Clef client.

### Checklist — Docs & QA (C, D)

- [ ] D: build the calibration set and run it with Dev A. Banglish samples in the manual test run.
- [ ] D: about 30 labelled post photos in the calibration set: ordinary items, ID cards, payment cards, screenshots with phone numbers, prohibited items.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/moderation/clef.test.ts`: the score-to-verdict mapping at and around each threshold, timeout, error and cap → review, the audit row has the model name and scores, images reach the fake client, a fake "readable ID number" answer on a photo gives personal data, and review (not reject) on an "ID or card" lost-and-found post.
- [ ] Run: `vp test clef moderation` and `vp run moderation:calibrate`

### Test Gate O3

- [ ] **Clef tests pass.**
- [ ] **The calibration run meets the agreed false-reject target, and the result is recorded in this phase.**

---

## Stretch phases (parked until the Sprint 4 go/no-go)

| Phase | Work                                                                                                                                   | Owner |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| S1    | Probation tracker (CGPA below threshold warning per term)                                                                              | Dev A |
| S2    | Retake improvement planner (which retakes raise CGPA the most)                                                                         | Dev A |
| S3    | Web push (Android Chrome, and iOS only after Add to Home Screen). The inbox stays the source of truth. Moved into Phase 5 (2026-10-20) | Dev B |

---

## Suggested Build Order

```
            Week 0      Weeks 1-2       Weeks 3-4             Weeks 5-6        Week 7             Week 8
Both/B:   P0 + P1 ──→ P2 → P3 → P4b → P7 → P8 → P9 ───────→ P11 → P11b ──→ P13 ─────────────→ P14 ─┐
Dev A:    P0 ───────→ P4 ──────────→ P5 → P6 → P9b ───────→ P10 → P12 ───────→ P13b ──────────→ bugs ├→ P15
C / D:    Docs & QA subsections inside each phase ─────────────────────────────────────────────────┘
Optional: O1 → O2 and O3, only after P14, if ever (see Optional phases)
```

**Dependencies that cross tracks:**

- P4b (design language) restyles P4's course screens, so it starts once P4's screens are merged.
- P8 (held-post notifications) needs P5's `notify()`. P5 is Dev A's first Sprint 2 task. Until it lands, Dev B codes against the signature in `docs/api-contracts.md`.
- P10 (resources) needs P7 (reports) and P8 (`screen()`). P11 (rides) needs the same.
- P9b (grade planner) needs P6's `grading.ts` and attempts. It lands before P10 starts.
- P11b (ride map) needs P11's areas and P3's service worker. Nothing else depends on it.
- P12 and P13 need P11's shared post kit. P13 also needs P12's post photos kit.
- P13b (help and contact) needs only P5's `notify()` and P7's admin role and audit, so it can move earlier if Dev A has room.

**Parallelism:** the two dev tracks run in parallel throughout. `cron.ts`, `limits.ts` and `src/server/db/schema.ts` are shared files: add your own job, limit or table in its own block, and never edit another phase's block in the same pull request. Rebase often in Weeks 5 to 7.

**Cut order (single, locked).** If time runs short, cut in this order:

1. Stretch phases S1 to S3
2. Ride map (P11b). The area filters from P11 stay.
3. Lost-and-found possible-match notification (P12 step 8)
4. Recurring-ride renewal (rides keep their default end date)
5. Contact admins thread (P13b steps 1 to 4). The Help screen stays and points to the `ADMIN_CONTACT_EMAIL` mailto.
6. Post photos (P12 photo setup and photos kit, P13 photos). Posts stay text-only.
7. Marketplace (P13)
8. Lost and found (P12)

The optional phases (O1 faculty profiles, O2 supervisor finder, O3 Clef auto-moderation) are not in the cut order: they are outside the release.

Shrink Phase 14 hardening only as a last resort. **Never cut** moderation, audit or reversal (P7, P8). The class routine (P9) is small and is not expected to be cut.

**Still parked (do not schedule without new evidence):**

- Native apps or app stores: the PWA covers every platform.
- File hosting: links only, which avoids copyright and storage risk.
- Photos on rides and on profiles: faces and personal data for little gain. (Lost-and-found and marketplace photos were un-parked on 2026-10-19, see Phase 12.)
- Automatic (OS-driven) dark mode: themes are picked by hand. The Night palette (Phase 4b) is the dark mode.
- Offline editing or sync: data is always live.
- Scraping Google Scholar, or letting the AI browse ORCID or Scholar: against the terms and gives messy data.
- Importing from the NSU portal: means scraping and login sharing.
- Storing finder chats, or sending earlier turns to the model: cost, drift and privacy.
- In-app payments, delivery or dispute handling.
- Email verification in the MVP: the schema is ready, so it can be added after the course.

---

## Open decisions

Each row names the phase that needs the answer. When it is settled, move it into that phase's locked block and delete the row.

| Decision                                                                                                         | Needed by         | Owner |
| ---------------------------------------------------------------------------------------------------------------- | ----------------- | ----- |
| Project deadline, demo date, required SRS format or presentation                                                 | P0                | C     |
| Clef-flash: re-check price and allowance before launch (findings below)                                          | O3                | Dev A |
| DeepSeek prepaid budget and global daily cap (model and price below)                                             | O2                | Dev A |
| App name, icon set, theme storage key                                                                            | P1, P3            | All   |
| Mock `BottomSheet` vs shadcn Drawer: **decided**, shadcn `Sheet` (`side="bottom"`)                               | P1                | Dev B |
| Confirm the four launch palettes                                                                                 | P1                | D     |
| New-account cooldown length, signup and login rate limits                                                        | P2                | Dev B |
| NSU term start dates and routine day letters                                                                     | P4, P9            | D     |
| Faculty list scope, and whether to tell the department before profiles go live                                   | O1                | All   |
| How many faculty have an ORCID; name matching vs the manual list for the rest                                    | O1                | D     |
| OpenAlex access terms (free key?) and rate limits                                                                | O1                | Dev A |
| Faculty summary refresh cadence (suggested: once a semester)                                                     | O1                | Dev A |
| Recurring ride policy (60-day default end date + renewal)                                                        | P11               | All   |
| Exact course codes and names for CSE299, CSE499, CSE498R (ask a CSE advisor)                                     | O2                | D     |
| Number of mods and target review turnaround (every photo post waits for a mod)                                   | P14               | All   |
| Target false-reject rate                                                                                         | O3                | All   |
| Campus lost-property office or security desk to link                                                             | P12               | D     |
| Marketplace prohibited-items list and ToS wording                                                                | P13               | All   |
| Post photo caps (bytes, max side, per-user and global daily uploads), cache lifetime, author-delete purge window | P11, P12          | Dev B |
| Support limits: open tickets per student, messages per hour, closed-ticket purge window                          | P13b              | Dev A |
| Stretch go/no-go                                                                                                 | Start of Sprint 4 | All   |
| "Unofficial student-run app" wording; whether NSU name approval can wait until after the demo                    | P15               | All   |

**Platform facts (checked 2026-10-18, re-check in P14):**

- **Workers Free:** 100,000 requests/day (resets 00:00 UTC), 10 ms CPU per request and per cron run, 50 subrequests per invocation, 5 Cron Triggers per account, 64 MiB uncompressed Worker size, 20,000 static files of at most 25 MiB each. Over the limit, requests fail; nothing is billed.
- **D1 Free:** 5 million rows read/day, 100,000 rows written/day, 5 GB storage. Over a daily limit, queries fail until 00:00 UTC (06:00 Asia/Dhaka).
- **Workers AI:** 10,000 Neurons/day free, then $0.011 per 1,000 Neurons (Workers Paid only; on Free, calls fail past the allowance). Resets 00:00 UTC.
- **Clef-flash** `@cf/cloudflare/clef-flash`: $0.038 per million input tokens (3,455 Neurons/M), output free, 24,576-token context. Call: `env.AI.run("@cf/cloudflare/clef-flash", { model: "clef-flash", state, questions })`, where each question is `noul`, `choice` (with `criteria`) or `score`; the answer is a probability per option. Clef `@cf/cloudflare/clef`: $0.240/M input (21,818 Neurons/M). So the free allowance covers about 2.9M Clef-flash input tokens a day. **Images (checked 2026-10-19):** PNG, JPEG or WebP in `images`, at most 4 per call, 4 MiB and 16 MP each, 8 MiB in total, no remote URLs. One token per 32×32 block plus 3 per image, capped at 1,024 per image; images under about 65,000 pixels are scaled up and over about 1 MP scaled down.
- **R2 (checked 2026-10-19):** free each month: 10 GB storage, 1M Class A operations (writes, lists), 10M Class B operations (reads). Then $0.015 per GB-month, $4.50 per million Class A, $0.36 per million Class B, no egress fees. Needs a payment method, and **overages are billed**, unlike Workers and D1 Free.
- **DeepSeek:** model id `deepseek-flash` (DeepSeek-V4.1-Flash-1017, 1M context). Per million tokens, off-peak/peak: input cache hit $0.003/$0.006, cache miss $0.15/$0.30, output $0.60/$1.20. Peak is 01:00–04:00 and 06:00–10:00 UTC on weekdays. The old `deepseek-v4-flash` name is retired but still accepted.

---

## Common Pitfalls to Avoid

Seeded with the platform gotchas already known from `plan_pwa.md`. Add real ones as they happen, tagged with the phase.

| Pitfall                                                                                      | How to avoid                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `vp dev` / `vp build` / `vp test` silently ignore a `package.json` script with the same name | Custom scripts get distinct names (`db:migrate:*`, `deploy:*`) and always run through `vp run` |
| Older `vite-plugin-pwa` breaks on Vite 8                                                     | Use ≥ 1.3.0, prove it in Phase 0, pin it                                                       |
| Hand-editing the `vite` alias entries Vite+ writes under pnpm                                | Only `vp create`, `vp migrate` and `vp upgrade` touch them                                     |
| PBKDF2 above 100,000 iterations throws on Workers                                            | Use 100,000 and store the params with the hash (P2)                                            |
| D1 queries fail after the daily row-read limit                                               | Index every filtered column, paginate feeds, never scan a full table in a request or in cron   |
| Seat count goes negative under two quick taps                                                | Single `UPDATE` with a `CHECK` constraint, never read-then-write (P11)                         |
| Hard-coded colors break non-default themes                                                   | Token classes only. Run the color search before every release                                  |
| "Today" or expiry is wrong around midnight because the Worker runs in UTC                    | Compute day boundaries in Asia/Dhaka through the shared helper                                 |
| A phone number in post text is flagged as a card number                                      | The card rule needs Luhn **and** excludes Bangladeshi phone formats (P8)                       |
| Safari returns PNG from `canvas.toBlob(..., "image/webp")`                                   | Check `blob.type` and fall back to the WASM encoder (P12)                                      |
| OpenAlex abstracts look empty                                                                | They come as an inverted index. Rebuild them in the adapter (O1)                               |

---

## Cross-references

| Doc                                     | Role                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`plan_pwa.md`](plan_pwa.md)            | Original project plan: product reasoning, full risk table, course outcome mapping. Background only |
| [`plan-template.md`](plan-template.md)  | Template this build plan follows                                                                   |
| `docs/api-contracts.md` (Phase 0)       | Agreed endpoint list and the `notify()` and `screen()` signatures                                  |
| SRS and design report (C)               | CO1 and CO2 deliverables. Must match the shipped build (DoD item 5)                                |
| UML diagrams (C)                        | Use case, class, sequence and activity diagrams                                                    |
| Figma (D)                               | Mobile-first screens for every phase                                                               |
| Manual test cases and defect report (D) | Linked to SRS requirement IDs (DoD item 4)                                                         |
| ToS, takedown policy, disclaimer (D)    | Legal wording referenced in Phases 10, 11, 12, 15, 16                                              |
| Calibration set (D)                     | About 150 labelled examples for Phase O3                                                           |
| Theme mock site                         | Source of the palettes and picker components ported in Phase 1 (add link)                          |

---

## Quick Reference — verify commands

```bash
vp install --frozen-lockfile       # clean install, same as CI
vp check                           # format + lint + type check
vp test                            # full unit + API suite
vp test <filter>                   # focused tests, e.g. `vp test grading`
vp build                           # production build
vp dev                             # local dev server (Worker + app)
vp run db:migrate:local            # apply migrations to local D1
vp run deploy:staging              # manual staging deploy (CI normally does this)
grep -rnE '#[0-9a-fA-F]{3,8}\b|bg-white|text-white|bg-black' src/client --include='*.tsx' --include='*.ts'   # hard-coded color search; should print nothing
```

Use focused `vp test <filter>` while working. Run `vp check && vp test && vp build` before calling a phase's Test Gate done.
