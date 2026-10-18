# Contributing to UniLink

Development guide for contributors: setting up your machine, running the project locally, and the branch and pull request rules.

## 1. Setup

### Prerequisites

- **Git** and a GitHub account with access to the repo.
- **Vite+ (`vp`)**, the single entry point for installing, checking, testing and building. Install it from <https://viteplus.dev> and confirm with `vp --version`. CI pins Vite+ 1.2.0, so use the same.
- **Node 24.22.0** (pinned in `.node-version`). Vite+ manages Node itself. Run `vp env setup` once (or `vp env on`) and it uses the pinned version. `vp env doctor` diagnoses problems.
- **pnpm** is downloaded on demand by `devEngines` in `package.json`. You don't install it yourself.

You do not need a Cloudflare account to work locally. Wrangler runs the Worker and a local D1 database on your machine.

### Install

```bash
git clone git@github.com:shithil17/UniLink.git
cd UniLink
vp install
cp .dev.vars.example .dev.vars
```

`vp install` also runs `vp config`, which sets up the git hooks.

`.dev.vars` holds local secrets for the Worker. It is git-ignored. **Never commit it** and never paste secrets into code, issues or PRs. Fill in only the values you need for the feature you're working on. External services (OpenAlex, ORCID, Crossref, DeepSeek, Clef) are faked in tests, so most work needs no real keys. Ask a maintainer if you need one.

### Database

Create the local D1 database and apply migrations:

```bash
vp run db:migrate:local
vp run seed            # optional sample data
```

After changing the Drizzle schema, generate a migration and commit it with your change:

```bash
vp run db:generate
vp run db:migrate:local
```

Staging migrations run automatically in CI on merge to `main`. Production migrations are applied by a maintainer by hand before tagging a release. Don't run `db:migrate:staging` or `db:migrate:prod` yourself.

## 2. Running locally

```bash
vp dev
```

This starts the Worker (`/api/*`) and the app together. Open the URL it prints. Use your browser's device toolbar to check phone-sized screens, because the UI is mobile-first.

### Commands

| Command                       | What it does                                             |
| ----------------------------- | -------------------------------------------------------- |
| `vp install` / `vp add <pkg>` | Install deps / add a dependency                          |
| `vp dev`                      | Run Worker and app locally                               |
| `vp check` / `vp check --fix` | Format, lint and type check (optionally fix)             |
| `vp test [<filter>]`          | Unit tests (`*.test.ts`) and API tests (`*.api.test.ts`) |
| `vp build`                    | Production build                                         |
| `vp run <script>`             | Custom scripts: `db:*`, `seed`, `cf:types`, ...          |

Rules of thumb:

- Use `vp`, never `pnpm` or `npm` directly.
- Custom scripts always go through `vp run <script>`, never `vp <script>`.
- Don't hand-edit the `vite` alias entries Vite+ writes under pnpm.
- After editing `wrangler.jsonc` bindings, run `vp run cf:types`.

Before opening a PR, run what CI runs:

```bash
vp check && vp test && vp build
```

## 3. Code conventions

The full list is in `CLAUDE.md`. The ones that most often come up in review:

- Shared Zod schemas live in `src/shared/schemas/`. Client forms and Hono validators both use them, so never define a shape twice.
- SQL lives only in `src/server/repos/`. Route handlers never build queries.
- Every limit, cap, cooldown, expiry and threshold lives in `src/server/limits.ts`.
- External services go behind an interface in `src/server/adapters/` with a fake. Tests never hit the network.
- Every user-written post calls `screen()` on create and edit. Rate limits are checked server-side before the action.
- Theme token classes only (`bg-app`, `text-ink`, `border-line`, `bg-surface`, ...). No hex values or Tailwind palette colors outside `src/client/index.css`.
- Never expose student IDs, never send usernames or student IDs to AI services, never put contact details in feed responses.
- Tests sit next to the code they cover. Leave at least one test that fails if the logic breaks.

## 4. Git workflow

`main` is **protected**. You can't push to it directly. All changes go through a pull request.

### Branches

Branch from an up-to-date `main`, one branch per feature or fix:

```bash
git switch main
git pull
git switch -c feat/ride-posting
```

Name branches `type/short-description` using the same types as commits: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): imperative summary`. Keep it concise, lowercase, with no trailing period.

```
feat(rides): add ride posting form
fix(auth): reject expired reset tokens
```

Check that `git config user.name` and `user.email` are your own identity for this repo before committing.

### Pull requests

1. Push your branch: `git push -u origin feat/ride-posting`.
2. Open a PR into `main`. Describe what changed and why, and how you tested it. Include screenshots for UI changes (phone-sized and desktop).
3. Keep PRs small and focused. Don't mix unrelated changes.
4. CI must be green (`vp check`, `vp test`, `vp build`).
5. **The other developer must review and approve it.** You can't merge your own PR without that review. Review assignments:
   - Dev A reviews rides, lost and found, and marketplace.
   - Dev B reviews resource sharing and faculty.
6. Address review comments with new commits on the same branch.
7. Merge once approved and green. Delete the branch afterwards.

If `main` moves while your PR is open, update your branch (`git fetch && git rebase origin/main`, or merge `main` in) and rerun the checks. Only force-push your own feature branches, with `git push --force-with-lease`. Never force-push `main`.

### After merge

Merging to `main` deploys to **staging** automatically. Production deploys happen when a maintainer pushes a `v*` tag.

## 5. Definition of done

1. Works on staging, on a phone-sized screen and on desktop.
2. Has unit or API tests as appropriate, and `vp check` and `vp test` pass in CI.
3. Its pull request was reviewed by the other developer.
4. Each requirement ID it covers has at least one manual test case.
5. The relevant SRS section and diagram match what was built.
