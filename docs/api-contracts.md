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

## Courses, attempts and student courses

| Method | Path                       | Auth | Schema                                                                               |
| ------ | -------------------------- | ---- | ------------------------------------------------------------------------------------ |
| GET    | `/api/courses/map`         | user | `courses.ts` → `courseMap` (empty state: `curriculum: null`)                         |
| POST   | `/api/courses/import`      | mod  | `courses.ts` → `curriculumImportEnvelope` (rows checked one by one) → `importResult` |
| GET    | `/api/attempts`            | user | `attempts.ts` → `attempt[]` (own only)                                               |
| POST   | `/api/attempts`            | user | `attempts.ts` → `attemptInput` → `attempt`                                           |
| PATCH  | `/api/attempts/:id`        | user | `attempts.ts` → `attemptInput` → `attempt` (not built yet)                           |
| DELETE | `/api/attempts/:id`        | user | – (not built yet)                                                                    |
| GET    | `/api/student-courses`     | user | `courses.ts` → `studentCourse[]` (own only)                                          |
| POST   | `/api/student-courses`     | user | `courses.ts` → `studentCourseInput` → `studentCourse`                                |
| PATCH  | `/api/student-courses/:id` | user | `courses.ts` → `studentCourseUpdate` → `studentCourse` (code is fixed once added)    |
| DELETE | `/api/student-courses/:id` | user | – (also deletes the course's attempts)                                               |

Attempts and student courses are readable by their owner only, never by mods or admins (enforced in the repo layer); another user's student course id is a 404. An attempt's course code must be in the user's curriculum (a slot code or an alternative) or one of their student courses (400 `unknown_course`). A student course code must not clash with the curriculum or their other courses (409 `code_taken`), its category must be one of the curriculum's categories (400 `unknown_category`), and adding past `limits.studentCoursesMax` is a 409 `student_course_limit`. The import keeps valid rows and lists the rest in `rejected`; a file with no valid row is a 422 and changes nothing.

## Inbox

| Method | Path                      | Auth | Schema                            |
| ------ | ------------------------- | ---- | --------------------------------- |
| GET    | `/api/inbox`              | user | `inbox.ts` → `page(notification)` |
| GET    | `/api/inbox/unread-count` | user | `inbox.ts` → `unreadCount`        |
| POST   | `/api/inbox/:id/read`     | user | –                                 |
| POST   | `/api/inbox/read-all`     | user | –                                 |

## Push

Web push is best effort and per device; the inbox stays the source of truth. A push carries only a title, body and a link to `/inbox`, built on the server from the notification type (`src/shared/notificationCopy.ts`), never payload text or anyone's identity. Push is off (the key endpoint answers `null`) until `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set.

| Method | Path                    | Auth  | Schema                                                                                                                |
| ------ | ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/push/public-key`  | user  | `push.ts` → `pushPublicKey` (`key: null` while push is not configured)                                                |
| POST   | `/api/push/subscribe`   | user  | `push.ts` → `pushSubscriptionInput` (rate-limited)                                                                    |
| POST   | `/api/push/unsubscribe` | user  | `push.ts` → `pushUnsubscribeInput` (own row only, idempotent)                                                         |
| POST   | `/api/push/test`        | admin | `push.ts` → `pushOk` (to the caller only; rate-limited, audited; 409 `push_not_configured` without the VAPID secrets) |

An endpoint must be on a known push service host (400 `unknown_push_service`). Subscribing an endpoint that already exists moves it to the caller (same device, new login). A user holds at most `limits.pushSubscriptionsMax` devices: past it, subscribing a new one is a 409 `push_subscription_limit` (nothing is dropped; the user switches another device off first). A send the push service answers with 404 or 410 deletes that subscription. Logging out removes the device's subscription (the client unsubscribes before it calls logout).

## Reports and moderation

Schemas are in `moderation.ts`. Mod routes need the mod role (admins pass too); admin routes need the admin role. Every action takes a `reason` (3 to 300 characters) and writes an audit row with a before-snapshot.

| Method | Path                                | Auth  | Schema / note                                                                                                                                                                                 |
| ------ | ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/reports`                      | user  | `reportRequest` → `reportCreated`. Rate-limited (`limits.reportCreate`); 404 unknown target, 400 own target, 409 `already_reported` (one open report per reporter per target)                 |
| GET    | `/api/mod/users`                    | mod   | `modUsersQuery` (`q` = username prefix, cursor) → `modUserPage`. Handle and state only: no student ID, email or name                                                                          |
| POST   | `/api/mod/users/:id/ban`            | mod   | `reasonBody`. Deletes the user's sessions. 409 if already banned                                                                                                                              |
| POST   | `/api/mod/users/:id/unban`          | mod   | `reasonBody`. 409 if not banned                                                                                                                                                               |
| POST   | `/api/mod/users/:id/reset-password` | mod   | `reasonBody` → `temporaryPassword` (shown once, `no-store`). Sets `must_change_password`, deletes sessions                                                                                    |
| GET    | `/api/mod/id-conflict?key=`         | mod   | `idConflictQuery` → `idConflictResult`. The only response with a student ID; a hit is logged (`id_lookup`)                                                                                    |
| POST   | `/api/mod/id-conflict/release`      | mod   | `releaseKeyRequest`. Bans the holder and replaces the key with `released:<id>` so its owner can sign up                                                                                       |
| POST   | `/api/mod/users/:id/clear-probing`  | mod   | `reasonBody`. Clears the probing flag and any running cooldown, and restarts the rejection count. Reversible by an admin. 409 `not_flagged`                                                   |
| GET    | `/api/mod/queue`                    | mod   | `pageQuery` → `modQueuePage`. Held posts (`pending_review`) then open reports in one list, oldest first within each; `total` is the whole queue. 400 on a cursor that is not from this list   |
| POST   | `/api/mod/posts/:type/:id/approve`  | mod   | `approvePostRequest` (reason optional). Publishes a held post, audits it and notifies the author (`post_approved`). 404 unknown post type, 409 `not_held`                                     |
| POST   | `/api/mod/posts/:type/:id/reject`   | mod   | `rejectPostRequest` (`reason` for the audit log, `category` for the author). Rejects a held post, audits it and notifies the author (`post_rejected`, with the category). 404, 409 `not_held` |
| GET    | `/api/mod/reports`                  | mod   | `modReportsQuery` (`status`, default `open`; open runs oldest first) → `modReportPage`                                                                                                        |
| POST   | `/api/mod/reports/:id/resolve`      | mod   | `resolveReportRequest` (`resolved` or `dismissed`). 409 if already closed                                                                                                                     |
| GET    | `/api/mod/queue`                    | mod   | held posts merged into the report list (not built yet)                                                                                                                                        |
| POST   | `/api/mod/queue/:id/approve`        | mod   | – (not built yet)                                                                                                                                                                             |
| POST   | `/api/mod/queue/:id/reject`         | mod   | – (not built yet)                                                                                                                                                                             |
| POST   | `/api/admin/users/:id/role`         | admin | `roleChangeRequest`: student to mod or mod to student                                                                                                                                         |
| GET    | `/api/admin/audit`                  | admin | `auditQuery` (filters: `actor`, `targetType`, `targetId`) → `auditPage`. Never returns the snapshot                                                                                           |
| POST   | `/api/admin/audit/:id/reverse`      | admin | `reasonBody` → `reverseResult`                                                                                                                                                                |

Who may be acted on (`src/shared/modPolicy.ts`, enforced on the server, mirrored on the screens): nobody acts on themselves or on an admin; a mod acts on students only; an admin acts on students and mods (403 `forbidden_target`).

Reversal rules (`src/server/reverse.ts`): ban, unban, role change, key release and soft delete put the snapshot back and log a `reverse` row. A password reset, a report resolution, an ID lookup and a reversal are not reversible (409 `not_reversible` / `is_reversal`); a row is reversed once (409 `already_reversed`); a released key someone has taken since is 409 `key_in_use`; a user who is an admin now is 403 `target_protected`.

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
notify(db: Db, userIds: number[], type: NotificationType, payload: Record<string, unknown>, opts: { now?: number; push?: PushSender | null } = {}): Promise<void>
// Pass `push: pushSenderFromEnv(c.env)` (src/server/adapters/push.ts) to also push to the targets' devices.
// A push failure never throws; at most `limits.pushFanoutMax` devices are pushed per call.

// src/server/moderation/submit.ts — what every post type calls on create and on an edit of screened text.
// mayPost (new-account wait, probing cooldown) → screen() → save(values) → audit as automod → count a rejection.
submitPost(db: Db, env: { SCREEN_FORCE_REVIEW?: string }, args: { user; targetType: string; input: ScreenInput; save: (values) => Promise<number> }): Promise<SubmitResult>
// SubmitResult = { ok: false; reason: "new_account" | "cooldown"; retryAfterMs } | { ok: true; id; outcome; cooldownStarted }

// src/server/moderation/screen.ts — Chain of Responsibility: rules → model step → verdict.
// A rule violation rejects without calling the model. Any model error, timeout, malformed answer or cap
// yields review (never auto-publish, never auto-reject). SCREEN_FORCE_REVIEW=1 (test only) forces review.
screen(input: { texts: string[]; images?: Uint8Array[]; contacts?: Contacts }, deps: { model: ModelStep; forceReview?: boolean }): Promise<ScreenOutcome>
// ScreenOutcome = { verdict: "approve" | "review" | "reject"; status: PostStatus; category: ReasonCategory; source; flags; confidence; scores; modelName; failure; snapshot }

// src/server/moderation/appeal.ts — "Ask a moderator to look" on the author's own rejected post (rate-limited).
askModerator(db: Db, input: { userId: number; targetType: string; targetId: number }): Promise<AskModeratorResult>

// src/server/repos/visibility.ts — the one filter on every post query: published, or own post, or viewer is a mod.
visibleTo(table: ModeratedTable, viewer: { id: number; role: Role } | null): SQL | undefined
```
