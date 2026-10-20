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

| Method | Path                    | Auth | Schema                                                                 |
| ------ | ----------------------- | ---- | ---------------------------------------------------------------------- |
| GET    | `/api/push/public-key`  | user | `push.ts` → `pushPublicKey` (`key: null` while push is not configured) |
| POST   | `/api/push/subscribe`   | user | `push.ts` → `pushSubscriptionInput` (rate-limited)                     |
| POST   | `/api/push/unsubscribe` | user | `push.ts` → `pushUnsubscribeInput` (own row only, idempotent)          |

An endpoint must be on a known push service host (400 `unknown_push_service`). Subscribing an endpoint that already exists moves it to the caller (same device, new login). A user holds at most `limits.pushSubscriptionsMax` devices: past it, subscribing a new one is a 409 `push_subscription_limit` (nothing is dropped; the user switches another device off first). A send the push service answers with 404 or 410 deletes that subscription. Logging out removes the device's subscription (the client unsubscribes before it calls logout).

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
notify(db: Db, userIds: number[], type: NotificationType, payload: Record<string, unknown>, opts: { now?: number; push?: PushSender | null } = {}): Promise<void>
// Pass `push: pushSenderFromEnv(c.env)` (src/server/adapters/push.ts) to also push to the targets' devices.
// A push failure never throws; at most `limits.pushFanoutMax` devices are pushed per call.

// src/server/moderation/screen.ts — Chain of Responsibility: rules → model step → verdict.
// Any model error, timeout or cap yields `review` (never auto-publish, never auto-reject).
screen(input: { kind: ReportTargetType; text: Record<string, string> }): Promise<ScreenResult>
// ScreenResult = { verdict: "approve" | "review" | "reject"; category: ReasonCategory }
```
