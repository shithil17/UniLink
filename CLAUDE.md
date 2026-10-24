# UniLink

Unofficial NSU CSE student companion PWA. `build_plan_pwa.md` is the source of truth: before coding, read the target phase's **Design decisions (locked in)** and don't reopen them. Tick its checklist boxes as items land. `plan_pwa.md` is background only.

## Stack

Vite+ (`vp`) + pnpm, React + TypeScript, Tailwind v4, shadcn/ui, TanStack Router + Query, React Hook Form + Zod, Hono on one Cloudflare Worker (serves `/api/*` and the PWA via Static Assets), D1 + Drizzle, `vite-plugin-pwa` ≥ 1.3.0.

- Use **Wrangler** (`wrangler.jsonc`), not the `cf` CLI.
- Use the shadcn MCP to find and add components, and Context7 for current library docs (Vite+ is beta and changes fast).

## Commands

```bash
vp install / vp add <pkg>     # never pnpm/npm directly
vp dev                        # Worker + app
vp check [--fix]              # format + lint + type check
vp test [<filter>]            # unit + API tests
vp build
vp run <script>               # custom scripts (db:migrate:*, deploy:*, seed, ...), never `vp <script>`
```

Before calling a checklist done: `vp check && vp test && vp build`.

## Rules

- Shared Zod schemas in `src/shared/schemas/` are used by both client forms and Hono validators. Never define a shape twice.
- SQL only in `src/server/repos/`. Route handlers never build queries.
- External services (OpenAlex, ORCID, Crossref, DeepSeek, Clef) go behind an interface in `src/server/adapters/` with a fake. Tests never hit the network.
- Every limit, cap, cooldown, expiry and threshold lives in `src/server/limits.ts`. No magic numbers in feature code.
- Time: store instants as UTC epoch ms; weekdays/times of day as Asia/Dhaka local. Compute "today", expiry and cron windows in Asia/Dhaka (cron fires in UTC).
- Reuse the shared helpers (`screen()`, `rateLimit()`, `notify()`, `audit()`, the post kit) instead of per-feature copies.
- Every user-written post calls `screen()` on create **and** edit. Rate limits are checked server-side before the action.
- Mods only soft-delete; every mod/automatic action writes an audit row.
- Never expose student IDs publicly, never send usernames or student IDs to AI services, never put contact details in feed responses.
- AI output is never shown as free text: validate model JSON with Zod, check IDs against the DB, build reply text on the server.
- Before touching any UI (components, routes, styles), invoke the `impeccable` skill and read `design-taste-frontend`'s `references/app-screens.md`. Follow `DESIGN.md` (once written), `PRODUCT.md` and the direction contract in `.impeccable/surfaces/src-client.md`. Don't use the Anthropic `frontend-design` skill.
- UI language: Pocket Planner (`build_plan_pocket_planner.md`, reference in `design/pocket-planner/`). Neutral grounds, flat borderless surfaces with hairline-separated rows, one accent per palette plus six course hues used only for course data, floating tab bar, soft rounded shapes, Figtree with Noto Sans Bengali for Bangla, course states use the shared state marks, shadow only on floating layers, no gradients or glass.
- UI: mobile-first. Theme token classes only (`bg-app`, `text-ink`, `border-line`, `bg-surface`, ...). No hex values, `bg-white`/`text-white`/`bg-black` or Tailwind palette colors outside `src/client/index.css`.
- Forms: shadcn form + React Hook Form + the shared Zod schema.
- Tests sit next to code: `*.test.ts` (unit), `*.api.test.ts` (API against local D1). Leave at least one test that fails if the logic breaks.
- Intentional limits get a `ceiling:` comment with the reason and what would justify revisiting.
- Secrets live in Worker secrets and the git-ignored `.dev.vars`, never in the repo.

## Pitfalls

- A `package.json` script named `dev`/`build`/`test` is silently ignored by `vp`. Use distinct names via `vp run`.
- Don't hand-edit the `vite` alias entries Vite+ writes under pnpm.
- PBKDF2 above 100,000 iterations throws on Workers.
- D1 has a daily row-read limit: index filtered columns, paginate feeds, never scan a full table.
- Counters (e.g. seats): single `UPDATE` with a `CHECK` constraint, never read-then-write.

## Commits

- Never push, open PRs or merge.
- Inside `/phase`, the orchestrating session commits each reviewed checklist block on its feature branch. Sub-agents never commit.
- Outside `/phase`, never commit and never ask to commit. When a checklist is completed, suggest a commit message.
- Never put "phase" or a phase number in branch names or commit messages.
- Conventional Commits: `type(scope): imperative summary`, concise, lowercase, no trailing period.
- Never mention phases, `build_plan_pwa.md`, `plan_pwa.md` or `CLAUDE.md` in commit messages or code.
- Never mention agents, skills, Claude or Codex in commit messages.
