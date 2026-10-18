# API contracts

The agreed endpoint list. Request and response **shapes live only in `src/shared/schemas/`** (named in the Schema column); this file never repeats them. Everything is served by one Worker under `/api`, same origin as the app, JSON in and out, session cookie for auth.

Auth column: `public` (no session), `user` (any signed-in user), `mod`, `admin`. Every list endpoint is paginated (`pageQuery` → `page(item)` in `common.ts`).

Rules that apply to every endpoint:

- Rate limits and caps are checked on the server before the action (`rateLimit()`), values from `src/server/limits.ts`.
- Every user-written post calls `screen()` on create **and** edit.
- Feeds never contain contact details or student IDs. Contacts come only from `GET /api/<type>/:id/contact`.
- Errors return `apiError` with a suitable status code.

## Health

| Method | Path          | Auth   | Schema                         |
| ------ | ------------- | ------ | ------------------------------ |
| GET    | `/api/health` | public | `health.ts` → `healthResponse` |

## Auth

| Method | Path                        | Auth   | Schema                              |
| ------ | --------------------------- | ------ | ----------------------------------- |
| POST   | `/api/auth/signup`          | public | `auth.ts` → `signupRequest` → `me`  |
| POST   | `/api/auth/login`           | public | `auth.ts` → `loginRequest` → `me`   |
| POST   | `/api/auth/logout`          | user   | –                                   |
| POST   | `/api/auth/change-password` | user   | `auth.ts` → `changePasswordRequest` |
| GET    | `/api/auth/me`              | user   | `auth.ts` → `me`                    |

## Courses and attempts

| Method | Path                  | Auth | Schema                                     |
| ------ | --------------------- | ---- | ------------------------------------------ |
| GET    | `/api/courses/map`    | user | `courses.ts` → `courseMap`                 |
| POST   | `/api/courses/import` | mod  | `courses.ts` → `courseImportRow[]`         |
| GET    | `/api/attempts`       | user | `attempts.ts` → `attempt[]` (own only)     |
| POST   | `/api/attempts`       | user | `attempts.ts` → `attemptInput` → `attempt` |
| PATCH  | `/api/attempts/:id`   | user | `attempts.ts` → `attemptInput` → `attempt` |
| DELETE | `/api/attempts/:id`   | user | –                                          |

Attempts are readable by their owner only, never by mods or admins (enforced in the repo layer).

## Inbox

| Method | Path                      | Auth | Schema                            |
| ------ | ------------------------- | ---- | --------------------------------- |
| GET    | `/api/inbox`              | user | `inbox.ts` → `page(notification)` |
| GET    | `/api/inbox/unread-count` | user | `inbox.ts` → `unreadCount`        |
| POST   | `/api/inbox/:id/read`     | user | –                                 |
| POST   | `/api/inbox/read-all`     | user | –                                 |

## Reports and moderation

| Method | Path                                | Auth  | Schema                            |
| ------ | ----------------------------------- | ----- | --------------------------------- |
| POST   | `/api/reports`                      | user  | `moderation.ts` → `reportRequest` |
| GET    | `/api/mod/queue`                    | mod   | reports + held posts              |
| POST   | `/api/mod/queue/:id/approve`        | mod   | –                                 |
| POST   | `/api/mod/queue/:id/reject`         | mod   | –                                 |
| GET    | `/api/mod/users`                    | mod   | search by username                |
| POST   | `/api/mod/users/:id/ban`            | mod   | –                                 |
| POST   | `/api/mod/users/:id/unban`          | mod   | –                                 |
| POST   | `/api/mod/users/:id/reset-password` | mod   | –                                 |
| POST   | `/api/mod/id-conflict/release`      | mod   | –                                 |
| POST   | `/api/admin/users/:id/role`         | admin | –                                 |
| GET    | `/api/admin/audit`                  | admin | –                                 |
| POST   | `/api/admin/audit/:id/reverse`      | admin | –                                 |

## Resources

| Method | Path                                      | Auth | Schema                                     |
| ------ | ----------------------------------------- | ---- | ------------------------------------------ |
| POST   | `/api/resources/requests`                 | user | `resources.ts` → `resourceRequestInput`    |
| GET    | `/api/resources/requests/mine`            | user | `resources.ts` → `page(resourceRequest)`   |
| PATCH  | `/api/resources/requests/:id`             | user | `resources.ts` → `resourceRequestInput`    |
| POST   | `/api/resources/requests/:id/submissions` | user | `resources.ts` → `resourceSubmissionInput` |
| POST   | `/api/resources/submissions/:id/accept`   | user | requester only                             |
| POST   | `/api/resources/submissions/:id/reject`   | user | requester only                             |

## Rides, lost and found, marketplace

The three post types share one pattern (the post kit). `<type>` is `rides`, `lostfound` or `market`.

| Method | Path                       | Auth | Schema                                      |
| ------ | -------------------------- | ---- | ------------------------------------------- |
| GET    | `/api/<type>`              | user | feed query → `page(<summary>)`, no contacts |
| GET    | `/api/<type>/mine`         | user | own posts, any status                       |
| GET    | `/api/<type>/:id`          | user | `<summary>` (subject to `visibleTo(user)`)  |
| POST   | `/api/<type>`              | user | `<input>`                                   |
| PATCH  | `/api/<type>/:id`          | user | `<input>`                                   |
| POST   | `/api/<type>/:id/renew`    | user | –                                           |
| POST   | `/api/<type>/:id/resubmit` | user | "Ask a moderator to look"                   |
| GET    | `/api/<type>/:id/contact`  | user | `common.ts` → `contacts`, rate-limited      |

Type-specific:

| Method | Path                         | Auth | Schema / note                     |
| ------ | ---------------------------- | ---- | --------------------------------- |
| PATCH  | `/api/rides/:id/seats`       | user | single `UPDATE`, auto `full` at 0 |
| POST   | `/api/lostfound/:id/resolve` | user | –                                 |
| POST   | `/api/market/:id/sold`       | user | –                                 |

Schemas: `rides.ts` (`rideInput`, `rideFeedQuery`, `rideSummary`), `lostFound.ts` (`lostFoundInput`, `lostFoundSummary`), `marketplace.ts` (`listingInput`, `listingSummary`).

## Faculty and finder

| Method | Path                             | Auth  | Schema                                                      |
| ------ | -------------------------------- | ----- | ----------------------------------------------------------- |
| GET    | `/api/faculty`                   | user  | `faculty.ts` → `page(facultySummary)`, `?q=` keyword        |
| GET    | `/api/faculty/:slug`             | user  | profile + recent papers                                     |
| POST   | `/api/mod/faculty/:id/hide`      | mod   | –                                                           |
| PUT    | `/api/admin/faculty/:id/summary` | admin | `faculty.ts` → `facultySummaryUpdate`                       |
| POST   | `/api/finder/match`              | user  | `faculty.ts` → `finderMatchRequest` → `finderMatchResponse` |

## Server helpers

```ts
// src/server/notify.ts — the single Observer entry point.
// Types: `notificationType` in src/shared/schemas/inbox.ts. A payload never names another user.
notify(userIds: number[], type: NotificationType, payload: Record<string, unknown>): Promise<void>

// src/server/moderation/screen.ts — Chain of Responsibility: rules → model step → verdict.
// Any model error, timeout or cap yields `review` (never auto-publish, never auto-reject).
screen(input: { kind: ReportTargetType; text: Record<string, string> }): Promise<ScreenResult>
// ScreenResult = { verdict: "approve" | "review" | "reject"; category: ReasonCategory }
```
