# API contracts

The agreed endpoint list. Request and response **shapes live only in `src/shared/schemas/`** (named in the Schema column); this file never repeats them. Everything is served by one Worker under `/api`, same origin as the app, JSON in and out, session cookie for auth.

Auth column: `public` (no session), `user` (any signed-in user), `student` (signed-in students only; mods and admins get 403), `mod`, `admin`. Every list endpoint is paginated (`pageQuery` → `page(item)` in `common.ts`).

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
| GET    | `/api/attempts/summary`    | user | CGPA, earned and remaining credits by category (own only)                            |
| PATCH  | `/api/attempts/:id`        | user | `attempts.ts` → `attemptUpdate` → `attempt`                                          |
| DELETE | `/api/attempts/:id`        | user | –                                                                                    |
| GET    | `/api/student-courses`     | user | `courses.ts` → `studentCourse[]` (own only)                                          |
| POST   | `/api/student-courses`     | user | `courses.ts` → `studentCourseInput` → `studentCourse`                                |
| PATCH  | `/api/student-courses/:id` | user | `courses.ts` → `studentCourseUpdate` → `studentCourse` (code is fixed once added)    |
| DELETE | `/api/student-courses/:id` | user | – (also deletes the course's attempts)                                               |

Attempts and student courses are readable by their owner only, never by mods or admins (enforced in the repo layer); another user's student course id is a 404. An attempt's course code must be in the user's curriculum (a slot code or an alternative) or one of their student courses (400 `unknown_course`). A student course code must not clash with the curriculum or their other courses (409 `code_taken`), its category must be one of the curriculum's categories (400 `unknown_category`), and adding past `limits.studentCoursesMax` is a 409 `student_course_limit`. The import keeps valid rows and lists the rest in `rejected`; a file with no valid row is a 422 and changes nothing. **An import of a program and version that already exist replaces every course of that version, including changes made in the mod Courses screen** (added, edited and hidden courses are all reset; the course ids change).

`courseMap` slots carry `chosenCode`: the slot code or alternative the student has an attempt on (a passing attempt first, then the better grade, then the most recent), or `null` while none is taken. The client prints the choice label from it with `slotLabel()` (`src/shared/slotChoice.ts`). A hidden course (see below) is left out of the map, of "Unlocked next", of the totals and of the codes an attempt may name, unless the student already has an attempt on the slot's code or one of its alternatives; then the slot stays in all of those and the grades count as before. The map is built per request and never cached.

### Course management (mods)

| Method | Path                             | Auth | Schema                                                                |
| ------ | -------------------------------- | ---- | --------------------------------------------------------------------- |
| GET    | `/api/mod/curricula`             | mod  | `modCourses.ts` → `modCurriculum[]` (program, version, `courseCount`) |
| GET    | `/api/mod/curricula/:id/courses` | mod  | `modCourse[]`: every slot in curriculum order, hidden ones included   |
| POST   | `/api/mod/curricula/:id/courses` | mod  | `courseInput` → `modCourse` (201); added at the end of the curriculum |
| PATCH  | `/api/mod/courses/:id`           | mod  | `coursePatch` (any of the input fields) → `modCourse`                 |
| POST   | `/api/mod/courses/:id/hide`      | mod  | `courseHideRequest` (`reason`) → `modCourse`                          |
| POST   | `/api/mod/courses/:id/unhide`    | mod  | `courseHideRequest` (`reason`) → `modCourse`                          |

`courseInput`: `kind` (`course` or `elective`), `code` (capitalised; a course code like `CSE115` or `CSE115L`, an elective code like `ELECT1`), `title`, `credits` (halves, 0 to 24), `category` (an existing one or a new name), `nonCredit`, `semester` (0 to 20 or null), `alternatives` (`{ code, title }[]`, none for an elective, no repeats) and `prereq`. `prereq` is **text** in requests, for example `CSE215 and (MAT120 or MAT125)` or `60 credits completed`; empty means none. The shared parser (`src/shared/prereqText.ts`) turns it into a `PrereqRule`, so a typo is a 400 `invalid_request` with the parser's message. Responses carry the rule as JSON (`prereq: PrereqRule | null`). `and` binds tighter than `or`; brackets group.

Refusals: a code already used by another slot, as its code or as an alternative, is `409 code_taken`. A prerequisite naming a code that is not a course (or alternative) of the curriculum is `400 prereq_unknown` with `codes`. An edit that removes a code another slot's prerequisite needs is `409 code_referenced`. Hide and unhide need a `reason`; `409 already_hidden` / `not_hidden` when the slot is already in that state. Shared alternatives between slots ("choose any three") are allowed, so alternatives are not compared across slots. Every write logs an audit row (`course_add`, `course_edit`, `course_hide`, `course_unhide`) with a before-snapshot of the changed columns. An admin can reverse an edit, hide or unhide (not an add); it is `409 value_in_use` if the old code was taken since or the old values would strand another prerequisite.

## Routine

| Method | Path               | Auth    | Schema                                                                  |
| ------ | ------------------ | ------- | ----------------------------------------------------------------------- |
| GET    | `/api/routine`     | student | `routine.ts` → `routineTermQuery` (`?year=&season=`) → `routineEntry[]` |
| POST   | `/api/routine`     | student | `routine.ts` → `routineInput` → `routineEntry` (201)                    |
| PATCH  | `/api/routine/:id` | student | `routine.ts` → `routineUpdate` → `routineEntry`                         |
| DELETE | `/api/routine/:id` | student | –                                                                       |
| DELETE | `/api/routine`     | student | `routineTermQuery` → `{ deleted }`: clears the whole term               |

Students only: a mod or admin gets 403 on every route, and another user's entry id is a 404. The term is `year` and `season` together, or neither for the current term (Asia/Dhaka). Times are `"HH:MM"` in Asia/Dhaka, days are NSU day letters (`S M T W R F A`, Sunday first, defined in `src/shared/routine.ts`). The end must be after the start (400). The course code must be in the user's curriculum or their student courses (400 `unknown_course`). Adding past `limits.routineEntriesMax` in a term is a 409 `routine_limit`; writes are rate-limited by `limits.routineWrites`. Overlaps are never refused: the client warns with `overlaps()` / `overlapsWith()`. The routine is never screened, sent to a model or used in a notification.

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

Reversal rules (`src/server/reverse.ts`): ban, unban, role change, key release and soft delete put the snapshot back and log a `reverse` row. A password reset, a report resolution, an ID lookup and a reversal are not reversible (409 `not_reversible` / `is_reversal`); a row is reversed once (409 `already_reversed`); a released key someone has taken since is 409 `key_in_use`; a user who is an admin now is 403 `target_protected`. A faculty edit, hide or unhide can be reversed too (adding faculty cannot; hide the row instead); if the old initials or name were taken since, it is 409 `value_in_use`. A course edit, hide or unhide can be reversed in the same way (adding a course cannot; hide it instead).

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

| Method | Path                             | Auth  | Schema                                                                      |
| ------ | -------------------------------- | ----- | --------------------------------------------------------------------------- |
| GET    | `/api/faculty`                   | user  | `faculty.ts` → `facultyOption[]`: visible faculty only, by name (see below) |
| GET    | `/api/faculty/profiles`          | user  | Phase 11: `faculty.ts` → `page(facultySummary)`, `?q=` keyword              |
| GET    | `/api/faculty/:slug`             | user  | Phase 11: profile + recent papers                                           |
| GET    | `/api/mod/faculty`               | mod   | `faculty.ts` → `modFaculty[]`: every row, hidden ones included              |
| POST   | `/api/mod/faculty`               | mod   | `facultyInput` → `modFaculty` (201)                                         |
| PATCH  | `/api/mod/faculty/:id`           | mod   | `facultyPatch` (any of the input fields) → `modFaculty`                     |
| POST   | `/api/mod/faculty/:id/hide`      | mod   | `facultyHideRequest` (`reason`) → `modFaculty`                              |
| POST   | `/api/mod/faculty/:id/unhide`    | mod   | `facultyHideRequest` (`reason`) → `modFaculty`                              |
| PUT    | `/api/admin/faculty/:id/summary` | admin | Phase 11: `faculty.ts` → `facultySummaryUpdate`                             |
| POST   | `/api/finder/match`              | user  | Phase 11: `faculty.ts` → `finderMatchRequest` → `finderMatchResponse`       |

`GET /api/faculty` returns `[{ id, name, initials | null, designation, department }]` ordered by name, capped at `limits.facultyListMax` (a bounded reference table: the client fetches it once, keeps it for an hour and searches it in the browser). It sends `Cache-Control: private, max-age=3600`. Hidden faculty are left out, but an attempt that already names a hidden faculty member still carries `faculty: { name, initials }` (see `attempt` in `attempts.ts`), so the student's own history keeps the name.

`facultyInput`: `name` (2 to 100), `initials` (optional, 2 to 6 letters or digits, unique across the university without regard to case), `designation`, `department` (a code from `src/shared/departments.ts`), `nsuPage` (optional, https on `northsouth.edu` or a subdomain). Empty `initials` and `nsuPage` mean none. Conflicts answer `409` with `error: "initials_taken"` or `"name_taken"` (the same name in the same department), which the form shows under the Initials and Name fields. Hide and unhide need a `reason`; `409 already_hidden` / `not_hidden` when the row is already in that state. Every write logs an audit row (`faculty_add`, `faculty_edit`, `faculty_hide`, `faculty_unhide`) with a before-snapshot of the changed columns; an admin can reverse an edit, hide or unhide (`409 value_in_use` if the old initials or name were taken since).

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
