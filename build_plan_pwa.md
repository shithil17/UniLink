# NSU Student Companion App: Build Plan (PWA)

This is the build plan for the unofficial, student-run NSU CSE companion PWA (CSE327, about 8 weeks). It turns [`plan_pwa.md`](plan_pwa.md) into ordered phases. Each phase has one owner, a checklist and a test gate. The doc is self-contained: every rule needed to build a feature is locked inside the phase that builds it, so nobody has to switch between docs while coding. `plan_pwa.md` stays as background (product reasoning, the full risk table, the course outcome mapping). It is not a second source of truth. If a rule changes, change it here and add a one-line note. This doc does not hold the SRS, UML, ToS or the manual test cases. Those are C's and D's deliverables and are listed in Cross-references.

---

## Status

**Status (2026-10-18):** Planning done. No code yet. Work starts at **Phase 0**. Changes from `plan_pwa.md`:

- The two cut orders that disagreed are now one locked order (see Suggested Build Order).
- Course "ticks" are graded attempts, so attempts are the only source of truth for done courses, credits and CGPA (Phase 4).
- The inbox moves to the start of Dev A's Sprint 2, because held-post notifications (Phase 8) write to it.
- Signup rate limits and the new-account cooldown move from Sprint 4 to Phase 2, because they are the main defence while there is no email verification. They use one shared `rateLimit()` helper.
- Week 0 now also proves D1 reads, an API test harness and the deploy pipeline.
- All limits live in one config file, and all times use Asia/Dhaka.

---

## Principles (locked)

**Architecture**

- One repo, one Cloudflare Worker, one D1 database per environment. The Worker serves both `/api/*` (Hono) and the built PWA (Workers Static Assets), so everything is on one origin: no CORS and no second host.
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
- Build forms from the shadcn/ui form components + React Hook Form + the shared Zod schema.

**Process**

- Vite+ is the entry point (`vp`). Custom scripts always go through `vp run <script>`, never `vp <script>`. Pin the Vite+ and Node versions and upgrade on purpose.
- Feature branches, pull requests, protected `main`. Every pull request is reviewed by the other developer. Dev A reviews rides, lost and found, and marketplace. Dev B reviews resource sharing and faculty.
- **Core feature freeze at the end of Week 6.** Only Phases 13 to 16 may land in Week 7. Week 8 is for hardening, documents and the demo.
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

| Role            | Library / Tool                                                                                                          | Why                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Toolchain       | **Vite+** (`vp`): Vite, Vitest, Oxlint, Oxfmt, Rolldown, task runner                                                    | One dependency and one config for dev, build, lint, format and test                 |
| Package manager | pnpm, one `package.json`, no workspaces                                                                                 | Simple. Vite+ drives it (`vp install`, `vp add`)                                    |
| App             | React + TypeScript, Tailwind CSS v4, shadcn/ui                                                                          | Team knows React. shadcn gives accessible parts that follow the theme tokens        |
| PWA             | `vite-plugin-pwa` **≥ 1.3.0** (Vite 8 support)                                                                          | Manifest + service worker without hand-written Workbox config                       |
| Routing         | TanStack Router (file-based, typed links, Zod search params)                                                            | Filters become shareable URLs that work with the back button. Loaders prefetch data |
| Server state    | TanStack Query                                                                                                          | Caching, loading and error states, invalidation after changes                       |
| Forms           | shadcn form + React Hook Form + Zod                                                                                     | shadcn default. Shares schemas with the API                                         |
| Theming         | Tailwind v4 `@theme` tokens + `:root[data-theme]` overrides, `ThemeProvider`, picker ported from the mock site          | Colors only. shadcn variables alias the tokens                                      |
| API             | Hono on Cloudflare Workers, Zod validation                                                                              | Small, typed, built for Workers                                                     |
| Hosting         | Workers Static Assets via `@cloudflare/vite-plugin`                                                                     | One deploy ships the API and the PWA together, so they also roll back together      |
| Database        | Cloudflare D1 (SQLite)                                                                                                  | Same platform as the Worker, free tier                                              |
| ORM             | Drizzle (`schema.ts`, `drizzle-kit` migrations)                                                                         | Typed queries, versioned migrations                                                 |
| Auth            | Own `sessions` table, hashed tokens, HttpOnly + Secure + SameSite=Lax cookie, WebCrypto PBKDF2                          | No third-party auth. Works on Workers                                               |
| Scheduled jobs  | Cloudflare Cron Triggers (same Worker)                                                                                  | No extra service                                                                    |
| AI text         | DeepSeek V4.1 Flash (`deepseek-flash`), key as a Worker secret                                                          | Cheap. Context caching suits the fixed faculty block                                |
| AI decisions    | Clef-flash (`@cf/cloudflare/clef-flash`) via the Workers AI binding. Clef (`@cf/cloudflare/clef`) as the fallback model | Same account, no key, very cheap screening                                          |
| Research data   | OpenAlex (primary), ORCID public API (cross-check), Crossref (optional). Google Scholar is link-out only                | Structured JSON. No scraping                                                        |
| CI              | GitHub Actions with `voidzero-dev/setup-vp`                                                                             | Official Vite+ setup                                                                |

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
├── drizzle.config.ts                                                                   [P0]
├── index.html                   # inline no-flash theme script + theme-color meta      [P1]
├── drizzle/                     # generated migrations (committed)
├── docs/
│   └── api-contracts.md         # agreed endpoint list; shapes live in src/shared       [P0]
├── scripts/
│   ├── seed.ts                  # small curriculum + fake students for dev/tests       [P0→P4]
│   ├── seed-admin.ts            # first admin from env vars                            [P2]
│   └── faculty-sync.ts          # OpenAlex/ORCID → trim → DeepSeek → admin route       [P11]
└── src/
    ├── shared/                  # imported by both client and server
    │   ├── schemas/             # Zod request/response schemas per module
    │   ├── studentId.ts         # regex, split into key + suffix, admission year       [P2]
    │   ├── themes.ts            # theme list (id, name, blurb, 5 swatches)             [P1]
    │   ├── prereq.ts            # Composite rule tree (all/any) evaluator              [P4]
    │   ├── grading.ts           # Strategy: grade scale + retake policy + CGPA         [P6]
    │   ├── terms.ts             # term type, current term (Asia/Dhaka)                 [P4]
    │   ├── routine.ts           # overlap check                                         [P9]
    │   ├── urlAllowlist.ts      # sharing hosts                                         [P10]
    │   └── contact.ts           # phone / wa.me / m.me / facebook.com rules            [P12]
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
    │   ├── adapters/            # openalex, orcid, crossref, deepseek, clef + fakes    [P11, P13, P14]
    │   ├── cron.ts              # list of cleanup jobs, one function per table         [P10]
    │   └── features/<module>/   # routes + services: auth, courses, attempts, inbox,
    │                            # mod, routine, resources, faculty, rides, lostfound,
    │                            # market, finder
    └── client/
        ├── main.tsx
        ├── index.css            # theme tokens, data-theme blocks, shadcn aliases      [P1]
        ├── routes/              # TanStack file routes
        ├── components/ui/       # shadcn components
        ├── components/theme/    # ThemeProvider, ThemePicker, ThemePickerTrigger       [P1]
        ├── components/post/     # ContactInput, ExpiryBadge, ReportButton, StatusNote  [P12]
        └── lib/                 # query client, api fetcher
```

Tests sit next to the code: `*.test.ts` for unit tests and `*.api.test.ts` for API tests that run against a local D1.

---

## Phase numbering

Phases are numbered 0 to 18 in **build order, not strict sequence**. Two developer tracks run in parallel (see Suggested Build Order). Within a track, do one phase at a time and pass its gate before moving on. A phase may start once its **Depends on** phases have passed their gates. Stretch work uses the `S` prefix (S1 to S3) and stays parked until the go/no-go at the start of Sprint 4.

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

- [ ] Git repo with protected `main`, feature branches and pull requests. Issue tracker with labels for severity, owner and requirement ID.
- [x] Pin Node (`engines` in `package.json` + `.node-version`) and the exact Vite+ version.
- [x] `vp create` (React + TypeScript). `vp add` hono, zod, drizzle-orm, drizzle-kit, wrangler, `@cloudflare/vite-plugin`, `vite-plugin-pwa`, `@tanstack/react-router` + router plugin, `@tanstack/react-query`, tailwind v4, react-hook-form, `@hookform/resolvers`.
- [x] One `vite.config.ts` from `vite-plus` with the plugins plus `lint`, `fmt`, `test` and `staged` blocks (`staged` runs `vp check --fix`).

### Checklist — Worker, D1 & deploy

- [x] `wrangler.jsonc` with `staging` and `production` envs, each with its own D1 binding `DB`, the static assets binding (SPA fallback to `index.html`), the `AI` binding and an empty cron trigger list.
- [ ] Drizzle `src/server/db/schema.ts` with an `app_meta` table. Generate the migration and apply it locally and to staging.
- [x] Hono app mounted at `/api`. `GET /api/health` returns `{ ok: true, dbVersion }` read from `app_meta`. Every non-`/api` path falls through to static assets.
- [x] Package scripts: `db:generate`, `db:migrate:local`, `db:migrate:staging`, `db:migrate:prod`, `deploy:staging`, `deploy:prod`, `seed`. Each one is called through `vp run`.
- [x] CI (`setup-vp`): `vp install --frozen-lockfile`, `vp check`, `vp test`, `vp build`. On merge to `main`, run the staging migrations and then deploy to staging. On a `v*` tag, deploy to production (the production migration is a manual step, see Phase 17).
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

- [ ] DeepSeek account with a small prepaid balance. Confirm the model name and price on DeepSeek's pricing page and store the key as a secret.
- [x] Read the Clef-flash model page: price, free daily allowance, context size, call format. Note the findings under Open decisions.
- [x] Check the current Workers, D1 (rows read and written per day) and cron free-tier limits and note them under Open decisions.
- [x] `docs/api-contracts.md`: the endpoint list for auth, courses, attempts, inbox, resources, rides, lost and found, marketplace and faculty, with the `notify()` and `screen()` signatures. Shapes are written as Zod stubs in `src/shared/schemas/`.

### Checklist — Docs & QA (C, D)

- [ ] C: start the SRS and write the elicitation survey.
- [ ] D: start the Figma flows (mobile-first). Agree the course spreadsheet columns with Dev A (code, title, credits, category, prerequisites expression, non-credit flag, curriculum version).

### Checklist — Test Scripts & Smoke Tests

- [x] `src/shared/smoke.test.ts`: a trivial unit test.
- [x] `src/server/features/health/health.api.test.ts`: `/api/health` returns `ok` and reads D1.
- [x] Run: `vp check && vp test && vp build`

### Test Gate 0

- [ ] **CI is green on `main`, and a merge deploys to staging automatically.**
- [ ] **The staging URL serves the app, and `/api/health` returns a value read from D1.**
- [ ] **`vp dev` runs with the Router, Cloudflare and PWA plugins together, and HMR works.**
- [ ] **(Manual) The app is installed to the home screen on Android Chrome and iOS Safari and opens standalone.**
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
> - Tokens (CSS variables): app background, hero gradient start and end, primary, accent, ink, soft, faint, body, line, tint, chip, deep, hero sub-text, **surface**. The default is defined in Tailwind v4's `@theme`. Every other palette is a `:root[data-theme="<id>"]` block that overrides the same variables.
> - shadcn's variables (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--ring`, …) are aliases of the tokens. Focus rings use the accent token.
> - `ThemeProvider` at the root route sets `data-theme` on `<html>` and saves the choice in `localStorage` under `<appname>-theme`. If the saved value is missing or unknown, or storage throws (private mode), it falls back to Ocean Teal.
> - An inline script in `index.html` applies the saved theme and sets `<meta name="theme-color">` to the theme's hero color before first paint. The manifest's `theme_color` and the icons stay static Ocean Teal.
> - Picker: `ThemePickerTrigger` on Settings (the current palette's swatches and name), which opens a sheet with all palettes. It uses `role="radiogroup"` and `aria-checked` and works with the keyboard.
> - Adding a palette = one CSS block + one entry in `src/shared/themes.ts`.
> - Contrast: body text ≥ 4.5:1, large text and controls ≥ 3:1, including text on primary buttons and on the hero gradient. A palette that fails is fixed before it ships.

### Checklist — Tokens & provider

- [ ] Tokens and the four palettes in `src/client/index.css`, with the shadcn aliases mapped.
- [ ] `src/shared/themes.ts` with id, name, blurb and five swatch colors per theme.
- [ ] `ThemeProvider` (read with try/catch, validate against `themes.ts`, set `data-theme`, save, update the `theme-color` meta).
- [ ] Inline no-flash script in `index.html` (same key, same validation, same fallback).
- [ ] Settings route with `ThemePickerTrigger` and the sheet. Decide the open item "mock `BottomSheet` vs shadcn Drawer" here and record it: `________`.

### Checklist — Docs & QA (C, D)

- [ ] D: contrast check for every palette (body text, large text, controls, text on primary buttons, text on the hero gradient). Failures are fixed in `index.css`.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/client/components/theme/ThemeProvider.test.tsx`: reads a saved theme, ignores an unknown value, falls back when storage throws, sets `data-theme`, saves changes, updates the `theme-color` meta.
- [ ] `src/shared/themes.test.ts`: every non-default theme in `themes.ts` has a `:root[data-theme="<id>"]` block in `index.css`, **and** the inline script in `index.html` knows the same ids and hero colors (the script cannot import `themes.ts`, so this test stops the copies from drifting apart).
- [ ] Run: `vp test theme`

### Test Gate 1

- [ ] **Theme tests pass.**
- [ ] **The hard-coded color search (Quick Reference) finds nothing in `src/client` outside `index.css`.**
- [ ] **(Manual) On the installed app, switching theme and restarting keeps the choice, with no flash of Ocean Teal, and the status bar color matches.**
- [ ] **(Manual, D) Every palette passes the contrast check.**

---

## Phase 2 — Auth, roles & abuse limits

**Owner:** Dev B · **When:** Sprint 1 (Weeks 1-2) · **Depends on:** Phase 0

**Goal:** Students sign up with username, password and a valid NSU ID, log in with a cookie session, and are held to signup limits and a new-account cooldown. Roles are enforced on every route, and the first admin is seeded.

> **Design decisions (locked in):**
>
> - **Student ID** format `YY S IIII SSS`, validated with `^\d{2}[123]\d{4}(042|642)$` after stripping spaces and dashes. The first 7 digits are the unique key (one account per student). The last 3 are stored separately. The first 2 digits (admission year) select the curriculum version. The ID is private, and only the username is public.
> - **No email verification in the MVP** (accepted risk: the format is checked, ownership is not). `users.email` and `users.email_verified_at` exist and are nullable, so verification can be added later without a migration. Mitigations: the unique ID key, signup rate limits, the new-account cooldown before posting or submitting links, and the mod ID-conflict tool (Phase 7).
> - **Passwords:** WebCrypto PBKDF2-SHA-256 with a random salt per user. Workers cap PBKDF2 at 100,000 iterations, so use that number. Store the algorithm and iteration count with the hash so it can change later.
> - **Sessions:** a random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie. Only its SHA-256 hash is stored in `sessions`. Logout and password change delete the session rows.
> - **Roles:** `student`, `mod`, `admin`, checked by `requireRole()` middleware. A banned user's sessions are rejected.
> - **First admin** is seeded from env vars and has `must_change_password = true`. The same flag is used for mod-issued temporary passwords (Phase 7). While it is set, every route except change-password returns 403.
> - **Rate limiting:** one `rateLimit(key, limit, windowMs)` helper backed by a D1 `rate_limits` table (key, window start, count). Every later limit uses it: contact reveal, match, gate, post creation, probing cooldown.
> - All values (signup per IP per hour, login attempts, cooldown length) live in `limits.ts`. Suggested defaults until the team decides: signup 5 per IP per hour, login 10 per username per 15 minutes, cooldown 24 hours.

### Checklist — Schema & helpers

- [ ] Tables: `users` (username unique, `student_key` unique, `student_suffix`, admission year, password hash/salt/params, role, `banned_at`, `must_change_password`, `email` nullable, `email_verified_at` nullable, `created_at`), `sessions`, `audit_log`, `rate_limits`.
- [ ] `src/shared/studentId.ts`: normalise, validate, split into key, suffix and admission year.
- [ ] `src/server/audit.ts`: `audit({ actor, action, targetType, targetId, before, reason })`. Reversal comes in Phase 7.
- [ ] `src/server/middleware/`: session loader, `requireUser`, `requireRole`, `rateLimit`, and a `canPost(user)` cooldown check for later phases.
- [ ] `src/server/limits.ts` created with the auth values.

### Checklist — API & screens

- [ ] `POST /api/auth/signup`, `/login`, `/logout`, `/change-password`, `GET /api/auth/me`.
- [ ] Signup and login are rate-limited. A duplicate 7-digit key gets a generic "this ID is already registered, contact a mod" message.
- [ ] `scripts/seed-admin.ts` (`vp run seed:admin`) creates the first admin from env vars.
- [ ] Screens: sign up, log in, change password (forced redirect when the flag is set), log out in Settings.

### Checklist — Docs & QA (C, D)

- [ ] C: SRS draft, use case diagram, survey sent out.
- [ ] D: login and signup screens in Figma. Test cases for signup, login, the forced password change and the ID format.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/studentId.test.ts`: valid IDs with suffix 042 and 642, semester digit 1 to 3 only, wrong lengths, spaces and dashes, the split.
- [ ] `src/server/features/auth/auth.api.test.ts`: a duplicate key is rejected, the cookie flags are set, only a hashed token is stored, a banned user is refused, a student calling a mod route gets 403, `must_change_password` blocks other routes, signup and login rate limits trigger, the cooldown blocks `canPost`.
- [ ] Run: `vp test auth studentId`

### Test Gate 2

- [ ] **All auth tests pass in CI.**
- [ ] **On staging, sign up → log in → log out works on a phone, and the seeded admin is forced to change the password.**

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

- [ ] Manifest: name, short_name, start_url, `display: standalone`, Ocean Teal `theme_color` and `background_color`, icons 192, 512 and maskable, `apple-touch-icon`. Placeholder icons until the app name and icons are decided.
- [ ] Service worker config as locked above (precache the shell, network-first `index.html`, network-only `/api`).
- [ ] Offline screen route/component and an `isOffline` check in the API fetcher.
- [ ] Update prompt with `useRegisterSW` from `virtual:pwa-register/react`, checked on launch.
- [ ] iOS install hint, dismissible, with the dismissal remembered in `localStorage` (inside try/catch).
- [ ] App layout shell (navigation, header, Home placeholder) per D's Figma, responsive.

### Checklist — Docs & QA (C, D)

- [ ] C: SRS non-functional requirements for install, offline shell and responsive layout.
- [ ] D: PWA test cases (install on both platforms, offline screen, update prompt, small phone and desktop layouts).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/client/lib/installHint.test.ts`: the hint shows only in iOS Safari when not standalone and not dismissed.
- [ ] Run: `vp test installHint && vp build` (then check `dist/` for hashed asset names)

### Test Gate 3

- [ ] **(Manual) In airplane mode, the installed app opens to the offline screen on Android and iOS.**
- [ ] **(Manual) After a new staging deploy, relaunching shows the update prompt, and reloading shows the new build.**
- [ ] **(Manual, DevTools) No `/api` response is served from the service worker cache.**

**Sprint 1 milestone (Phases 2-4):** a user can sign up, log in, see the CSE course map and install the app.

---

## Phase 4 — Course map & prerequisites

**Owner:** Dev A · **When:** Sprint 1 · **Depends on:** Phase 0 (Phase 2 for the logged-in user)

**Goal:** Mods import the CSE curriculum, and students see the course map for their curriculum version with categories, credit totals, prerequisite status and done courses taken from their attempts.

> **Design decisions (locked in):**
>
> - Curriculum is imported from CSV or JSON by a mod (D prepares the data). Courses have code, title, credits, category, a non-credit flag and a prerequisite rule. They belong to a curriculum version chosen by admission year.
> - Prerequisites are a **Composite** rule tree: a course leaf, `all` groups and `any` groups. They are evaluated in `src/shared/prereq.ts`.
> - **Attempts are the only source of truth** (decided 2026-10-18). A course is _done_ when it has a passing attempt (any grade that earns credits, so not F, I or W). The "tick" on the map opens a quick attempt form: course + letter grade, with term and faculty optional. Phase 6 adds the full form and the retake rules. There is no separate ticks table.
> - Terms: a shared `Term` value (year + Spring/Summer/Fall). The current term is worked out in Asia/Dhaka from one set of term start dates in `src/shared/terms.ts` (D confirms the dates).

### Checklist — Data & API

- [ ] Tables: `curricula`, `courses` (with the prereq rule stored as JSON), `attempts` (user, course, grade, term nullable, created_at). Faculty is added in Phase 6.
- [ ] Import endpoint (mod only), validated by a Zod schema. It reports the rows it rejected and why. The import is logged with `audit()`.
- [ ] `GET /api/courses/map` returns courses with each one's status for the current user (done, available, locked), plus category and credit totals.
- [ ] `POST /api/attempts` (quick form). Attempts are visible only to their owner and never to mods (enforced in the repo layer).

### Checklist — Screens

- [ ] Course map screen: grouped by category, with credit totals and status chips. Tapping a course opens its prerequisites and the quick attempt form.

### Checklist — Docs & QA (C, D)

- [ ] D: course map screens. The first CSE course data batch (early semesters first) in the agreed spreadsheet format.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/prereq.test.ts`: leaf, nested `all`/`any`, empty rule, an F, I or W attempt does not satisfy a prereq, a passing attempt does.
- [ ] `src/server/features/courses/courses.api.test.ts`: the import rejects bad rows, only mods can import, the map reflects attempts, the user only sees their own attempts.
- [ ] `scripts/seed.ts` now seeds a small curriculum and two fake students.
- [ ] Run: `vp test prereq courses`

### Test Gate 4

- [ ] **Prereq and course API tests pass.**
- [ ] **On staging, a seeded student records a grade from the map, and the course turns done and unlocks its dependants.**

---

## Phase 5 — Notification inbox

**Owner:** Dev A · **When:** Sprint 2, first item · **Depends on:** Phase 2

**Goal:** Any server code can call `notify()`, and users see their own notifications with an unread count and mark them read.

> **Justification:** Moved to the start of Sprint 2 because Dev B's held-post notifications (Phase 8) and every later fan-out write to it.

> **Design decisions (locked in):**
>
> - The in-app inbox is the source of truth. `ceiling:` web push is stretch (S3).
> - `notify(userIds, type, payload)` is the single **Observer** entry point. Types are an enum in `src/shared/schemas/inbox.ts`. A payload never contains another user's identity.

### Checklist

- [ ] `notifications` table (user, type, payload JSON, `read_at`, `created_at`), indexed on (user, `read_at`).
- [ ] `src/server/notify.ts` with batched inserts.
- [ ] `GET /api/inbox` (paginated), `GET /api/inbox/unread-count`, `POST /api/inbox/:id/read`, `POST /api/inbox/read-all`.
- [ ] Inbox screen and an unread badge in the navigation.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/inbox/inbox.api.test.ts`: `notify()` writes rows for every target, a user sees only their own, mark-read works, another user's id gets 404.
- [ ] Run: `vp test inbox`

### Test Gate 5

- [ ] **Inbox tests pass, and the `notify()` signature matches `docs/api-contracts.md`.**

---

## Phase 6 — CGPA, attempts & retakes

**Owner:** Dev A · **When:** Sprint 2 · **Depends on:** Phase 4

**Goal:** Students record every attempt (course, term, grade, faculty) and see their best-grade CGPA, retake eligibility and credits remaining by category.

> **Design decisions (locked in):**
>
> - **Scale:** A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, C- 1.7, D+ 1.3, D 1.0, F 0.0. Students enter letter grades only, never numeric scores.
> - **Best grade per course counts**, and credits count once.
> - **F** counts in CGPA as 0.0 but earns no graduation credits. **I and W** are excluded from both CGPA and earned credits. Non-credit courses are excluded from CGPA.
> - **Retake rule:** a new attempt is allowed only while the best grade so far (ignoring I and W) is below B+. There is no limit on the number of attempts while that holds. I and W attempts never block a retake.
> - The scale and the retake policy are **Strategy** objects in `src/shared/grading.ts`, so a different scale or policy is a new strategy, not an `if`.
> - The basic `faculty` table (name, initials, designation) is created here for the attempt picker. Phase 11 extends it.
> - Mods and admins cannot read attempts or CGPA. This is enforced in the repo layer, not only in the UI.

### Checklist

- [ ] `faculty` table and a seeded list (D). Faculty picker component.
- [ ] Migration: `attempts.faculty_id` (nullable). The full attempt form makes term required for new attempts.
- [ ] `grading.ts`: grade points, `bestAttempt()`, `cgpa()`, `earnedCredits()`, `canRetake()`.
- [ ] Attempt API: create, edit, delete. Create and edit run `canRetake()` and return a clear error when a retake is not allowed.
- [ ] Screens: attempt history per course, CGPA summary, credits remaining by category, a retake badge.

### Checklist — Docs & QA (C, D)

- [ ] C: class diagram. Update the SRS from the survey results.
- [ ] D: CGPA screens. First manual test cases. Finish the CSE course data. Start the faculty list (name, designation, NSU page, Scholar URL, ORCID, checked OpenAlex author ID).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/grading.test.ts`: every grade point, best of several attempts, F then a pass, F only, I and W only, a non-credit course, the retake blocked at B+ and above, allowed below it, I and W never block, credits counted once.
- [ ] `src/server/features/attempts/attempts.api.test.ts`: retake validation on create and edit, a mod gets 403 on another user's attempts and CGPA.
- [ ] Run: `vp test grading attempts`

### Test Gate 6

- [ ] **Grading and attempt tests pass.**
- [ ] **(Manual) A seeded student's CGPA on staging matches a hand calculation done by D.**

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

- [ ] `reports` table. `audit_log` gets an index on target and actor.
- [ ] `softDelete()`, `reverse()` and the reversal rules for each action type (soft delete, ban, role change, key release).
- [ ] Mod API: user list and search by username, ban and unban, ID-conflict release, temporary password reset, report list and resolve.
- [ ] Admin API: promote and demote mods, the audit log list, reverse.
- [ ] `POST /api/reports` (rate-limited).
- [ ] Mod panel screens: users, reports queue (Phase 8 merges held posts into it), audit log with a reverse button (admin only).

### Checklist — Docs & QA (C, D)

- [ ] C: moderation flow activity diagram.
- [ ] D: mod panel test cases (ban, reset, release, reverse).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/mod/mod.api.test.ts`: students get 403 on mod routes and mods get 403 on admin routes, every action writes an audit row with a snapshot, reverse restores the exact state and logs itself, a duplicate open report is refused, the temporary password forces a change, mods cannot read attempts.
- [ ] Run: `vp test mod`

### Test Gate 7

- [ ] **Mod tests pass.**
- [ ] **On staging, an admin reverses a ban and a soft delete, and both reversals appear in the audit log.**

---

## Phase 8 — Screening pipeline & review queue

**Owner:** Dev B · **When:** Sprint 2 · **Depends on:** Phase 5, Phase 7

**Goal:** One `screen()` function runs the deterministic rules and a stub model step, posts end up published, pending review or rejected, and mods clear held posts from the same queue as reports.

> **Justification:** Every post type calls `screen()` from its first commit, so the real Clef step in Phase 14 is a swap behind an interface and no feature code changes.

> **Design decisions (locked in):**
>
> - **Chain of Responsibility:** rules → model step (interface; Phase 8 ships a stub that always approves) → verdict `approve | review | reject` with a reason category: prohibited item, personal data, scam or spam, abuse or harassment, off-topic, fine.
> - **Deterministic rules** (no AI): student IDs (the Phase 2 regex, applied after removing spaces and dashes inside digit runs), card-like numbers (13 to 19 digits that pass a Luhn check and are **not** a Bangladeshi phone number, so phone numbers in text are not flagged), URLs that are not on the allowlist, contact format, length limits, a banned-word list. A clear rule violation rejects without calling the model.
> - **Screened text:** rides (pickup, destination, notes), lost and found (title, description, place), marketplace (title, description), resource requests and submissions (notes). Contact fields, grades and the routine are never sent to the model.
> - **Statuses** on every post table: `published | pending_review | rejected`. A post in `pending_review` is visible only to its author ("Waiting for a moderator") and to mods, using one shared `visibleTo(user)` query filter. Rejected posts show a category-level reason only, never scores. The author can edit and resubmit, or tap "Ask a moderator to look" (which moves it to the queue).
> - **Fail safe:** a model error, a timeout or the daily cap means `pending_review`. Unscreened text is never auto-published and never auto-rejected. The rules still apply.
> - **Edits** that change screened text run the pipeline again.
> - **Probing:** 3 rejections in one hour mean a 1-hour posting cooldown and a flag on the user in the mod panel.
> - **Audit:** every automatic decision writes an audit row with actor `automod`, the model name, the category, the scores and a text snapshot.
> - A test-only flag forces `review`, so the queue can be exercised before Clef exists.
> - The mod's decision overrides the model. The author gets a `notify()` message on approve or reject.

### Checklist

- [ ] `src/server/moderation/rules.ts` and `screen.ts` with a `ModelStep` interface and a `StubModelStep`.
- [ ] Shared column set and helpers for moderation status. `visibleTo(user)` filter in the repo layer.
- [ ] Probing counter through `rateLimit()`, and the mod-panel flag.
- [ ] Mod queue: held posts and reports in one list, showing the text, the author's username, the model category and confidence, the rule flags, and the queue size at the top. Approve and reject actions notify the author.
- [ ] Reject-reason messages from D, mapped per category.

### Checklist — Docs & QA (C, D)

- [ ] C: post screening flow activity diagram.
- [ ] D: write the reject-reason messages.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/moderation/rules.test.ts`: student IDs with and without spaces, a Luhn card number is caught, a BD phone number in text is not, a non-allowlisted URL, length limits, banned words.
- [ ] `src/server/moderation/screen.test.ts`: a rule violation never calls the model step (spy), a stub approve publishes, the forced flag gives review, a model error or timeout gives review, the audit row has actor `automod`.
- [ ] `src/server/moderation/queue.api.test.ts`: a pending post is hidden from other students, the mod decision overrides and notifies the author, 3 rejections trigger the cooldown, an edit is screened again.
- [ ] Run: `vp test moderation`

### Test Gate 8

- [ ] **Moderation tests pass.**
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
> - `ceiling:` manual entry only. There is no import from NSU's portal, which keeps the app free of scraping and login sharing.

### Checklist

- [ ] `routine_entries` table and API (owner only).
- [ ] `src/shared/routine.ts`: `overlaps(entries)`.
- [ ] Home "Today" list (time order, Asia/Dhaka) with a link to the full routine. A full-week screen with "No classes" on empty days. An add/edit form showing the overlap warning.

### Checklist — Docs & QA (C, D)

- [ ] D: routine screens and test cases.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/routine.test.ts`: overlap, touching end and start (no overlap), different days, "today" correct across UTC midnight.
- [ ] `src/server/features/routine/routine.api.test.ts`: owner only, a mod gets 403, clear term.
- [ ] Run: `vp test routine`

### Test Gate 9

- [ ] **Routine tests pass.**
- [ ] **(Manual) On a phone, entries show on Home on the right weekday and in time order.**

**Sprint 2 milestone (Phases 5-9):** CGPA and retakes work end to end. Students can enter their routine and see today's classes on Home. Mods and admins can act, reverse actions and review held posts from the queue.

---

## Phase 10 — Resource sharing

**Owner:** Dev A · **When:** Sprint 3 (Weeks 5-6) · **Depends on:** Phase 5, Phase 6, Phase 7, Phase 8

**Goal:** Students request materials by course and/or faculty, matching students are notified, others submit allowlisted links, and the requester accepts, rejects or reports them, with expiry and purge handled by cron.

> **Design decisions (locked in):**
>
> - Links only. `ceiling:` no file hosting. URLs must be `https` and on the allowlist of sharing hosts in `src/shared/urlAllowlist.ts`.
> - A request needs a course, a faculty, or both. The notification goes to users with an attempt that matches **every field the request sets**, excluding the requester and banned users, through `notify()`. The requester is never told who was notified.
> - Several students can submit to one request, and the requester accepts one. The requester sees the uploader's username. Only the requester sees the link.
> - The requester sets the expiry. Cron hard-deletes expired open requests, and hard-deletes fulfilled requests 3 months after fulfilment. The UI says this clearly.
> - The new-account cooldown applies to submitting links. Request notes and submission notes go through `screen()`. Reports use `target_type` `resource_request` and `resource_submission`.
> - This phase creates `src/server/cron.ts`: one `scheduled()` handler that runs a list of cleanup jobs, one function per table. Later phases add a job to the list and never edit another phase's job.

### Checklist

- [ ] `resource_requests` and `resource_submissions` tables with moderation status, expiry and `fulfilled_at`. Indexes for the fan-out query (attempts by course and faculty).
- [ ] Create request (screened, fan-out notify), list my requests, submit link (allowlist, cooldown, screened), accept, reject, report.
- [ ] `cron.ts` with the two resource jobs. A cron trigger added in `wrangler.jsonc` for both environments.
- [ ] Screens: new request, my requests with their submissions, submit to a request (reached from the notification), clear expiry and purge wording.

### Checklist — Docs & QA (C, D)

- [ ] C: resource flow sequence diagram.
- [ ] D: resource screens and test cases. ToS, disclaimer and takedown policy drafts.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/urlAllowlist.test.ts`: allowed hosts, look-alike hosts (`drive.google.com.evil.io`), http rejected.
- [ ] `src/server/features/resources/resources.api.test.ts`: the fan-out matches the course, the faculty and both, the requester is excluded, only the requester sees the link, accepting one fulfils the request, the cooldown blocks new accounts, expiry filtering, the cron purge timing, a report on a submission reaches the queue.
- [ ] Run: `vp test resources urlAllowlist`

### Test Gate 10

- [ ] **Resource tests pass.**
- [ ] **On staging, request → notification → submit → accept works between two seeded students, and the link is hidden from the second one's view of other requests.**

---

## Phase 11 — Faculty profiles & research sync

**Owner:** Dev A (Dev B takes the profile screens if Sprint 2 slipped) · **When:** Sprint 3 · **Depends on:** Phase 6 (faculty table), Phase 7 (report, hide)

**Goal:** Every CSE faculty member in scope has a profile with verified papers, an AI summary built only from fetched JSON, topic tags and a Scholar link, and students can keyword-search them.

> **Justification:** Profiles and keyword search are the shipped fallback if AI matching (Phase 13) slips, so they must stand on their own.

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

- [ ] **Step 1:** extend `faculty` (slug, photo link, Scholar URL, ORCID, OpenAlex ID, tags, summary, summary date, sync input JSON, `limited_data`, `hidden`) and add `faculty_papers`. Seed from D's verified list.
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

### Test Gate 11

- [ ] **Faculty tests pass with fakes, and no test touches the network.**
- [ ] **(Manual) A real sync has run for the full faculty list on staging. D has checked a sample against Scholar. Keyword search finds people by topic.**

---

## Phase 12 — Shared post kit & rides

**Owner:** Dev B (Dev A reviews) · **When:** Sprint 3 · **Depends on:** Phase 7, Phase 8

**Goal:** Students post one-off and recurring rides with seats, price and contacts, filter the feed, reveal contacts with rate limiting, and report rides, all built on a shared post kit that lost and found and marketplace reuse.

> **Design decisions (locked in) — shared post kit:**
>
> - **Contacts:** at least one of phone (`^\+8801[3-9]\d{8}$`), WhatsApp (`https://wa.me/…`), Messenger or Facebook (`https://m.me/…`, `https://facebook.com/…`). Validated in `src/shared/contact.ts` and shown by a shared `ContactInput`. Contacts are returned only by `GET /api/<type>/:id/contact`, which needs a login and is rate-limited through `rateLimit()`.
> - **Expiry and renewal:** one helper that computes `expires_at` and enforces each type's renewal rule. Feeds filter out expired rows in the query.
> - **Cleanup:** one cron job per table, added to `cron.ts`.
> - **Reports and mod removal:** one new `target_type` per table. `softDelete()` and `reverse()` from Phase 7.
> - **Screening:** `screen()` on create and edit. `visibleTo(user)` on every feed and detail query. `canPost()` cooldown on create.
>
> **Design decisions (locked in) — rides:**
>
> - Own `rides` table. Fields: pickup and destination (free text), vehicle type (bike, car, SUV, bus), total seats, seats remaining, price per seat in taka, contacts, optional notes.
> - **One-off:** a departure date and time, and it expires at departure. **Recurring:** days of the week, a departure time and an end date (default 60 days out). The poster can renew. Check constraints enforce which fields each kind needs.
> - The poster can edit, change or reduce seats, or mark the ride fully booked. Seats remaining = 0 → status `full` automatically. `CHECK (seats_remaining BETWEEN 0 AND total_seats)`, and seat changes are one `UPDATE` statement, so there are no race conditions and the count never goes out of range.
> - Feed filters (Zod search params in the URL): pickup or destination text, vehicle type, date or weekday. Paginated, with the filtered columns indexed.
> - The platform does not arrange or guarantee rides. The ToS and an in-app notice say that students arrange rides and payment themselves.

### Checklist — Build order

- [ ] **Shared kit:** `contact.ts`, `ContactInput`, the contact reveal endpoint pattern, the expiry helper, `ReportButton`, `StatusNote` ("Waiting for a moderator" and rejection reason with "Ask a moderator to look").
- [ ] **Step 1:** `rides` table, check constraints and indexes.
- [ ] **Step 2:** create and edit API with contact validation and `screen()`. One-off rides first, then recurring.
- [ ] **Step 3:** seat logic (single-statement update, auto `full` at 0).
- [ ] **Step 4:** feed and filters, paginated, excluding expired rides in the query.
- [ ] **Step 5:** expiry and renewal, and the ride cleanup job in `cron.ts`.
- [ ] **Step 6:** screens: post a ride, edit, my rides, feed, detail with contact buttons (`tel:`, `wa.me`, `m.me`), safety notice.
- [ ] **Step 7:** report a ride, mod removal, admin reversal (`target_type` `ride`).

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams for rides.
- [ ] D: ride screens. ToS ride-safety wording. Ride test cases. Start the auto-moderation calibration set (Phase 14).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/shared/contact.test.ts`: valid and invalid phone numbers, wa.me, m.me and facebook.com links, at least one required.
- [ ] `src/server/features/rides/rides.api.test.ts`: seats never go below 0 or above the total, auto `full` at 0, one-off vs recurring validation, the default end date, renewal, the feed hides expired and pending rides, the contact reveal needs a login and hits its rate limit, the feed response has no contact fields, report + removal + reversal, edits are screened again.
- [ ] Run: `vp test contact rides`

### Test Gate 12

- [ ] **Ride tests pass.**
- [ ] **(Manual) On a phone, post a recurring ride, filter by weekday, reveal the contact, and the WhatsApp and dialer links open the right app.**

**Sprint 3 milestone = core feature freeze (end of Week 6):** every Must-have works on staging except AI matching (13), the Clef step (14), lost and found (15) and marketplace (16). Faculty profiles with keyword search already work.

---

## Phase 13 — AI matching & supervisor finder chat

**Owner:** Dev A · **When:** Week 7, first half · **Depends on:** Phase 11

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

### Checklist — Build order

- [ ] **Step 5:** `POST /api/finder/match`: limits, prompt builder, `DeepSeekClient` (match mode), validation, ID filter, one retry, server-built reply.
- [ ] **Step 6:** chat UI (greeting, chips, 500-character input, cards, fallback reply, footer note). Popup and full-screen layouts sharing state.
- [ ] **Step 7:** tests with the fake DeepSeek client.

### Checklist — Docs & QA (C, D)

- [ ] C: faculty matching sequence diagram, including the chat message round trip.
- [ ] D: finder test cases (chips, limits, no-match reply, mobile and desktop).

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/finder/match.api.test.ts`: malformed JSON → one retry → fixed reply, unknown and hidden IDs are dropped, per-user and global limits are checked before the client is called (spy), empty and over-length input, only the current message is in the prompt, the prompt contains no username or ID, nothing is written to D1 except rate-limit counters.
- [ ] Run: `vp test finder`

### Test Gate 13

- [ ] **Finder tests pass.**
- [ ] **(Manual) On staging, the chips and a free-text interest give sensible suggestions with working profile links on phone and desktop.**

---

## Phase 14 — Clef auto-moderation & finder gate

**Owner:** Dev A (thresholds with D) · **When:** Week 7 · **Depends on:** Phase 8, Phase 13, D's calibration set

**Goal:** The stub model step is replaced by Clef-flash with thresholds tuned on a labelled set, and the supervisor finder stops vague, off-topic and abusive messages before DeepSeek is called.

> **Design decisions (locked in):**
>
> - `ClefClient` adapter on the `AI` binding with a timeout and a daily cap. Any failure → `pending_review` (the fail safe from Phase 8). Default model `@cf/cloudflare/clef-flash`. Switch to `@cf/cloudflare/clef` only if calibration shows Clef-flash cannot meet the target.
> - Two thresholds, both from calibration and never guessed: auto-reject needs a high score on a clear category, auto-approve needs a high score on "fine", and everything in between goes to a human. The target is a very low false-reject rate (the exact number is an Open decision). The review band is kept narrow so the mod queue stays manageable.
> - Students write English, Bangla and Banglish. The calibration set (about 150 examples: allowed posts, each prohibited category, personal data, spam, Banglish) covers all three, and uncertain results go to humans.
> - The model sees only post text, never usernames or IDs.
> - **Finder gate:** cheap checks first (empty, over 500 characters, symbols only), then one Clef decision: relevant / too vague / off-topic / abusive or instruction attempt. Only "relevant" goes on to DeepSeek. The others get fixed server-written replies, and "too vague" has its own reply that suggests topics. Chips skip the gate. The gate sees only the message, never the faculty list. Gate limit: 30 per user per day. If Clef is down or capped, the message goes to the match step, where the normal limits apply. Only messages that pass the gate count toward the 10-per-day match limit. `note:` the gate saves money but is not a security boundary. The match call still treats the text as data.
> - **Fallback (cut order step 4):** if Clef is not ready, the stub stays and posts publish straight away after the rules. The report flow covers the rest.

### Checklist — Build order

- [ ] **Step 5:** `ClefClient` + fake. Confirm the exact call format on the model page. Wire it in as the `ModelStep` behind the existing interface.
- [ ] **Step 6:** calibration runner script (`vp run moderation:calibrate`): runs the labelled set and reports the false-reject rate, the false-approve rate and the share sent to review at the candidate thresholds. Lock the chosen thresholds in `limits.ts` and record them here: `________`.
- [ ] **Step 7:** finder gate in front of `/api/finder/match`.
- [ ] **Step 8:** tests with the fake Clef client (Dev A and Dev B).

### Checklist — Docs & QA (C, D)

- [ ] D: finish the calibration set early in Week 7 and run it with Dev A. Banglish samples in the manual test run.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/moderation/clef.test.ts`: the score-to-verdict mapping at and around each threshold, timeout, error and cap → review, the audit row has the model name and scores.
- [ ] `src/server/features/finder/gate.api.test.ts`: only "relevant" reaches DeepSeek (spy), each other class returns its fixed reply, chips skip the gate, the gate limit applies, a Clef failure falls through to the match limits.
- [ ] Run: `vp test clef gate moderation` and `vp run moderation:calibrate`

### Test Gate 14

- [ ] **Clef and gate tests pass.**
- [ ] **The calibration run meets the agreed false-reject target, and the result is recorded in this phase.**

---

## Phase 15 — Lost and found

**Owner:** Dev B (Dev A reviews) · **When:** Week 7 · **Depends on:** Phase 12

**Goal:** Students post lost or found items, filter and search the feed, contact each other through the shared kit, and mark posts resolved. Found posts keep a private verification detail.

> **Design decisions (locked in):**
>
> - Type `lost | found`. Title, category (ID or card, wallet, phone, laptop or charger, bag, keys, books or notes, other), description, place (free text), date, contacts (shared kit), status `open | resolved`. `ceiling:` text only, no photos.
> - Found posts have an optional private **verification detail** that only the poster can see. It is never included in any other user's response.
> - Student IDs and card numbers are rejected by the Phase 8 rules. The form warns about it up front.
> - Expires after 30 days, and the poster can renew once. Resolved or expired posts leave the feed and are hard-deleted 14 days later by cron.
> - Feed filters: type, category, place text, date, keyword.
> - **Possible match** (last item, first to cut): a new found post sends a `notify()` to the owners of open lost posts in the same category from the last 14 days. Nobody is told who else was notified.
> - The ToS says the app does not hold items or verify ownership. The post screen points to the campus security or lost-property office.

### Checklist — Build order

- [ ] **Step 1:** `lost_found_posts` table with check constraints and indexes on category, status and expiry.
- [ ] **Step 2:** create, edit, resolve, renew (once), using the shared kit, `screen()` and `canPost()`.
- [ ] **Step 3:** confirm the ID and card rules fire for lost-and-found text, and add the form warning.
- [ ] **Step 4:** feed, filters and search, excluding expired and resolved posts in the query.
- [ ] **Step 5:** cleanup job in `cron.ts` (14 days after expiry or resolution).
- [ ] **Step 6:** screens: post, edit, my posts, feed, detail with contact buttons, verification detail field, lost-property pointer.
- [ ] **Step 7:** report, mod removal, reversal (`target_type` `lost_found`).
- [ ] **Step 8:** possible-match notification.

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams.
- [ ] D: screens (early Week 7), ID-number warning wording, test cases.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/lostfound/lostfound.api.test.ts`: an ID number in the text is rejected, the verification detail is never returned to a non-owner (feed, detail and contact endpoints), renewal allowed once, resolve hides the post, the cron timing, report + removal, the possible match notifies the right users and not the poster.
- [ ] Run: `vp test lostfound`

### Test Gate 15

- [ ] **Lost-and-found tests pass.**
- [ ] **(Manual) A found post triggers a possible-match notification for a seeded lost post on staging.**

---

## Phase 16 — Marketplace

**Owner:** Dev B (Dev A reviews) · **When:** Week 7 · **Depends on:** Phase 12

**Goal:** Students list second-hand items with price, condition and contacts, filter the feed, and mark listings sold, within the 10-active-listing limit.

> **Design decisions (locked in):**
>
> - Title, category (books, electronics, calculators and lab gear, room and furniture, clothing, other), description, condition (new, like new, good, fair), price in taka or free, a negotiable flag, pickup area, contacts (shared kit), status `active | sold`.
> - Expires after 60 days, and the seller can renew. Sold or expired listings leave the feed and are hard-deleted 30 days later by cron.
> - At most 10 active listings per user. The new-account cooldown applies.
> - Feed filters: category, price range, condition, keyword.
> - Prohibited items (ToS and post form): weapons, drugs, alcohol, tobacco, exam papers or answers, pirated or copied material, university property, anything illegal in Bangladesh.
> - The app does not handle payment, delivery or disputes. An in-app notice says to meet in public places on campus and inspect items before paying.

### Checklist — Build order

- [ ] **Step 1:** `marketplace_listings` table with check constraints on price and status, and indexes on category, status and expiry.
- [ ] **Step 2:** create, edit, mark sold, renew, using the shared kit, `screen()`, `canPost()` and the active-listing limit.
- [ ] **Step 3:** feed and filters, excluding sold and expired listings in the query.
- [ ] **Step 4:** cleanup job in `cron.ts` (30 days after sold or expiry).
- [ ] **Step 5:** screens: post, edit, my listings, feed, detail with contact buttons, prohibited-items list, meet-in-public notice.
- [ ] **Step 6:** report, mod removal, reversal (`target_type` `listing`).

### Checklist — Docs & QA (C, D)

- [ ] C: update the SRS and diagrams.
- [ ] D: screens, prohibited-items text, test cases.

### Checklist — Test Scripts & Smoke Tests

- [ ] `src/server/features/market/market.api.test.ts`: the 11th active listing is refused, price and condition validation, free listings, mark sold hides the listing, renew, the cron timing, report + removal + reversal.
- [ ] Run: `vp test market`

### Test Gate 16

- [ ] **Marketplace tests pass.**
- [ ] **(Manual) Post, filter by price range, and mark sold on a phone on staging.**

---

## Phase 17 — Hardening & release

**Owner:** Dev B (lead), Dev A (bug fixes) · **When:** Week 8 · **Depends on:** Phases 1 to 16 (or their cut fallbacks)

**Goal:** Production is live from a tag, a rollback has been rehearsed, and every cross-cutting rule (limits, moderation on every post type, privacy, themes, PWA) is checked against the real app.

> **Design decisions (locked in):**
>
> - Production deploys only by tag, with a changelog entry. Migrations run before the deploy and stay backward compatible for one release. Export D1 (or note the D1 Time Travel point) before any production migration.
> - Rollback = redeploy the previous Worker version. The PWA ships inside the Worker, so the app and the API roll back together. Hashed assets and network-first `index.html` mean users get the rollback on their next launch.

### Checklist

- [ ] Every write route has a `rateLimit()` (signup, login, every post create, reports, contact reveal, match, gate). List them in `limits.ts` comments.
- [ ] Reports, mod removal and admin reversal confirmed for resource submissions, rides, lost and found, and marketplace listings.
- [ ] Hard-coded color search is clean. D has checked the key screens (Home, course map, feeds, forms, mod panel, finder chat) in every palette at phone width.
- [ ] Re-check the Clef-flash price, free allowance and context, the DeepSeek price, and the Workers and D1 limits. Set the production caps and the DeepSeek prepaid budget.
- [ ] Re-run the calibration set against production thresholds.
- [ ] Privacy note in the app (AI providers get only post text and interest text, never usernames or IDs, and finder text is not stored).
- [ ] Lighthouse PWA audit passes.
- [ ] Production migration, then `vp run deploy:prod` from a tag. Admin seeded in production and password changed.
- [ ] Rollback rehearsal: deploy tag N+1 to staging, roll back to N, confirm the app and API both revert and the installed app picks up the change.

### Test Gate 17

- [ ] **CI is green on the release tag, and production `/api/health` is OK.**
- [ ] **(Manual) The rollback rehearsal succeeded and was written down.**
- [ ] **(Manual) The full cross-type report, removal and reversal check passed.**

---

## Phase 18 — Delivery: documents, full test run & demo

**Owner:** C, D, All · **When:** Week 8 · **Depends on:** Phase 17

**Goal:** The final SRS, design report, diagrams and manual test report match what shipped, and the team has done two demo dry runs on an installed phone.

### Checklist

- [ ] C: final SRS (functional and non-functional requirements, including PWA install, offline shell and responsive behaviour, the societal impact section, survey results) and design report (SOLID, coupling and cohesion, and the patterns: **Composite** prereqs, **Strategy** grading and retakes, **Observer** `notify()`, **Repository** layer, **Chain of Responsibility** `screen()`, **Adapter** clients).
- [ ] C: use case, class, sequence and activity diagrams updated to the shipped build.
- [ ] D: full manual test run linked to requirement IDs, including Banglish posts, install and update on Android and iOS, every palette, and no theme flash on reload. Defect report.
- [ ] D: demo script. Final ToS, takedown policy, disclaimer and "unofficial student-run app" wording.
- [ ] All: two demo dry runs on an installed phone. Final release tag.

**Course outcome mapping:** CO1 Requirements (20%) → SRS + survey. CO2 OO design (30%) → diagrams + design report. CO3 Implementation (30%) → the one-Worker PWA, API, D1 and cron, the shared moderation flow, OpenAlex + DeepSeek + Clef behind adapters, and the live demo on an installed phone. CO4 Testing (20%) → unit, API and manual tests linked to SRS IDs.

### Test Gate 18

- [ ] **(Manual) Every SRS requirement ID has a test case, and the final run's defect report is published.**
- [ ] **(Manual) Two dry runs were completed, and the release is tagged.**

---

## Stretch phases (parked until the Sprint 4 go/no-go)

| Phase | Work                                                                                                  | Owner |
| ----- | ----------------------------------------------------------------------------------------------------- | ----- |
| S1    | Probation tracker (CGPA below threshold warning per term)                                             | Dev A |
| S2    | Retake improvement planner (which retakes raise CGPA the most)                                        | Dev A |
| S3    | Web push (Android Chrome, and iOS only after Add to Home Screen). The inbox stays the source of truth | Dev B |

---

## Suggested Build Order

```
            Week 0      Weeks 1-2       Weeks 3-4             Weeks 5-6        Week 7             Week 8
Both/B:   P0 + P1 ──→ P2 → P3 ─────→ P7 → P8 → P9 ───────→ P12 ─────────→ P15 → P16 ──────→ P17 ─┐
Dev A:    P0 ───────→ P4 ──────────→ P5 → P6 ─────────────→ P10 → P11 ───→ P13 → P14 ──────→ bugs ├→ P18
C / D:    Docs & QA subsections inside each phase ─────────────────────────────────────────────────┘
                                                                         ▲ core feature freeze (end of Week 6)
```

**Dependencies that cross tracks:**

- P8 (held-post notifications) needs P5's `notify()`. P5 is Dev A's first Sprint 2 task. Until it lands, Dev B codes against the signature in `docs/api-contracts.md`.
- P10 (resources) needs P7 (reports) and P8 (`screen()`). P12 (rides) needs the same.
- P14 needs D's calibration set (started in Sprint 3, finished early in Week 7) and P13's match endpoint for the gate.
- P15 and P16 need P12's shared post kit.

**Parallelism:** the two dev tracks run in parallel throughout. `cron.ts`, `limits.ts` and `src/server/db/schema.ts` are shared files: add your own job, limit or table in its own block, and never edit another phase's block in the same pull request. Rebase often in Weeks 5 to 7.

**Cut order (single, locked).** If time runs short, cut in this order:

1. Stretch phases S1 to S3
2. Lost-and-found possible-match notification (P15 step 8)
3. Recurring-ride renewal (rides keep their default end date)
4. The Clef step (P14). The rules, the stub and the human queue stay, and posts publish after the rules.
5. Marketplace (P16)
6. AI matching (P13). Profiles and keyword search stay. If only the chat UI slips, ship the single interest box.
7. Lost and found (P15)

Shrink Phase 17 hardening only as a last resort. **Never cut** moderation, audit or reversal (P7, P8). The class routine (P9) is small and is not expected to be cut.

**Still parked (do not schedule without new evidence):**

- Native apps or app stores: the PWA covers every platform.
- File hosting: links only, which avoids copyright and storage risk.
- Photo uploads in lost and found or the marketplace: privacy and moderation cost.
- Dark mode: themes are colors only.
- Offline editing or sync: data is always live.
- Scraping Google Scholar, or letting the AI browse ORCID or Scholar: against the terms and gives messy data.
- Importing from the NSU portal: means scraping and login sharing.
- Storing finder chats, or sending earlier turns to the model: cost, drift and privacy.
- In-app payments, delivery or dispute handling.
- Email verification in the MVP: the schema is ready, so it can be added after the course.

---

## Open decisions

Each row names the phase that needs the answer. When it is settled, move it into that phase's locked block and delete the row.

| Decision                                                                                      | Needed by         | Owner    |
| --------------------------------------------------------------------------------------------- | ----------------- | -------- |
| Project deadline, demo date, required SRS format or presentation                              | P0                | C        |
| Clef-flash: re-check price and allowance before launch (findings below)                       | P14, P17          | Dev A    |
| DeepSeek prepaid budget and global daily cap (model and price below)                          | P13               | Dev A    |
| App name, icon set, theme storage key                                                         | P1, P3            | All      |
| Mock `BottomSheet` vs shadcn Drawer (one overlay system)                                      | P1                | Dev B    |
| Confirm the four launch palettes                                                              | P1                | D        |
| New-account cooldown length, signup and login rate limits                                     | P2                | Dev B    |
| NSU term start dates and routine day letters                                                  | P4, P9            | D        |
| URL allowlist of sharing hosts                                                                | P10               | Dev A, D |
| Faculty list scope, and whether to tell the department before profiles go live                | P11               | All      |
| How many faculty have an ORCID; name matching vs the manual list for the rest                 | P11               | D        |
| OpenAlex access terms (free key?) and rate limits                                             | P11               | Dev A    |
| Faculty summary refresh cadence (suggested: once a semester)                                  | P11               | Dev A    |
| Recurring ride policy (60-day default end date + renewal)                                     | P12               | All      |
| Exact course codes and names for CSE299, CSE499, CSE498R (ask a CSE advisor)                  | P13               | D        |
| Target false-reject rate, number of mods, target review turnaround                            | P14               | All      |
| Campus lost-property office or security desk to link                                          | P15               | D        |
| Marketplace prohibited-items list and ToS wording                                             | P16               | All      |
| Stretch go/no-go                                                                              | Start of Sprint 4 | All      |
| "Unofficial student-run app" wording; whether NSU name approval can wait until after the demo | P18               | All      |

**Platform facts (checked 2026-10-18, re-check in P17):**

- **Workers Free:** 100,000 requests/day (resets 00:00 UTC), 10 ms CPU per request and per cron run, 50 subrequests per invocation, 5 Cron Triggers per account, 64 MiB uncompressed Worker size, 20,000 static files of at most 25 MiB each. Over the limit, requests fail; nothing is billed.
- **D1 Free:** 5 million rows read/day, 100,000 rows written/day, 5 GB storage. Over a daily limit, queries fail until 00:00 UTC (06:00 Asia/Dhaka).
- **Workers AI:** 10,000 Neurons/day free, then $0.011 per 1,000 Neurons (Workers Paid only; on Free, calls fail past the allowance). Resets 00:00 UTC.
- **Clef-flash** `@cf/cloudflare/clef-flash`: $0.038 per million input tokens (3,455 Neurons/M), output free, 24,576-token context. Call: `env.AI.run("@cf/cloudflare/clef-flash", { model: "clef-flash", state, questions })`, where each question is `noul`, `choice` (with `criteria`) or `score`; the answer is a probability per option. Clef `@cf/cloudflare/clef`: $0.240/M input (21,818 Neurons/M). So the free allowance covers about 2.9M Clef-flash input tokens a day.
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
| Seat count goes negative under two quick taps                                                | Single `UPDATE` with a `CHECK` constraint, never read-then-write (P12)                         |
| Hard-coded colors break non-default themes                                                   | Token classes only. Run the color search before every release                                  |
| "Today" or expiry is wrong around midnight because the Worker runs in UTC                    | Compute day boundaries in Asia/Dhaka through the shared helper                                 |
| A phone number in post text is flagged as a card number                                      | The card rule needs Luhn **and** excludes Bangladeshi phone formats (P8)                       |
| OpenAlex abstracts look empty                                                                | They come as an inverted index. Rebuild them in the adapter (P11)                              |

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
| Calibration set (D)                     | About 150 labelled examples for Phase 14                                                           |
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
