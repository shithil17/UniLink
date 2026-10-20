# Software Requirements Specification (draft)

UniLink is an unofficial, student-run companion app for North South University (NSU) students. This draft covers what is built through Phase 9: accounts, the installable app shell, the course map, the inbox and web push, CGPA and attempts, moderation, content screening with the review queue, the faculty directory and the class routine. Later features (resources, rides, lost and found, marketplace, faculty profiles) are listed under [Planned](#planned) and get requirements as they land.

Requirement IDs (`FR-*`, `NFR-*`) are stable. Test cases in [`test-cases.md`](test-cases.md) cite them. The build rules behind each requirement live in `build_plan_pwa.md`; the endpoints in [`api-contracts.md`](api-contracts.md).

## 1. Purpose and scope

Help NSU students see their program's course map, track grades and CGPA, and get notified, in one installable web app, with volunteer moderators keeping it safe. It is not an official NSU system and holds no official records.

Out of scope: registration, payments, official transcripts, native app-store builds, offline data.

## 2. Users

| Role    | Description                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------- |
| Student | Signs up with an NSU student ID and email. Sees only their own grades and courses.              |
| Mod     | A trusted student. Bans, resets passwords, handles reports and ID conflicts, imports curricula. |
| Admin   | Seeded first account. Everything a mod does, plus role changes, the audit log and reversals.    |

Mods and admins cannot read any student's attempts, CGPA or routine. They keep their own, like any student.

## 3. Functional requirements

### Accounts and sessions

| ID   | Requirement                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1 | A visitor can sign up with a username (3 to 20 characters: lowercase letters, digits, underscore), full name (2 to 80), `@northsouth.edu` email, valid student ID and a password (8 to 128).                                    |
| FR-2 | The student ID must match `YY S IIII V PP` (semester digit 1 to 3, verification digit 0 or 6, program code from the NSU list) with an admission year not in the future and not over 8 years old. Spaces and dashes are ignored. |
| FR-3 | One account per student: the first 7 digits of the ID are unique. A duplicate gets a generic "this ID is already registered, contact a mod" message.                                                                            |
| FR-4 | A user can log in and out with a cookie session (30 days). A banned user cannot log in and their sessions are rejected.                                                                                                         |
| FR-5 | A user can change their password. Changing it ends their sessions.                                                                                                                                                              |
| FR-6 | While `must_change_password` is set (seeded admin, mod-issued temporary password) every route except change-password refuses the user, and the app redirects to the change-password screen.                                     |
| FR-7 | Student ID, email and full name are never shown to other users. Only the username is public.                                                                                                                                    |
| FR-8 | New accounts cannot post or submit links for 24 hours (`canPost`).                                                                                                                                                              |

### Abuse limits

| ID    | Requirement                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| FR-9  | Signups are limited to 5 per client IP per hour and logins to 10 per username per 15 minutes.                  |
| FR-10 | Every limit, cap, cooldown and expiry is a named value in `src/server/limits.ts`, checked on the server first. |

### Installable app

| ID    | Requirement                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------- |
| FR-11 | The app installs to the home screen on Android and iOS with name, icons and standalone display.         |
| FR-12 | With no connection the app shows an offline screen with a retry button. API responses are never cached. |
| FR-13 | After a new deploy the app shows "Update available, reload" and loads the new build on reload.          |
| FR-14 | In iOS Safari, outside standalone mode, a dismissible "Add to Home Screen" hint shows once.             |
| FR-15 | A user picks one of five palettes in Settings. The choice persists and applies before first paint.      |

### Course map

| ID    | Requirement                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-16 | A student sees the course map of their program (last two digits of the ID) and curriculum version (admission year), grouped by category with credit totals. |
| FR-17 | Each slot shows done, available or locked from the prerequisite rule and the student's attempts. A program with no curriculum shows an empty state.         |
| FR-18 | A course is done when it has a passing attempt (not F, I or W). Attempts are the only source of truth.                                                      |
| FR-19 | A student can add their own courses (code, title, credits, category) to fill elective slots, exclude one from the transcript, edit and delete it (max 40).  |
| FR-20 | Earned credits may exceed the degree total with no block. Excluded courses count toward no total, prerequisite or CGPA.                                     |
| FR-21 | A student can mark any course waived (`WV`): done, credits earned, no CGPA effect.                                                                          |
| FR-22 | A mod can import a curriculum from a JSON file. Valid rows are kept, rejected rows are listed with reasons, and the import is audited.                      |

### CGPA and attempts

| ID    | Requirement                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-23 | A student can add, edit and delete attempts: course, letter grade, term (year and season), optional faculty.                                          |
| FR-24 | CGPA uses the NSU scale (A 4.0 down to F 0.0) and the best grade per course. Credits count once. F counts as 0.0; I, W and WV are excluded from CGPA. |
| FR-25 | A new attempt is allowed only while the best grade so far (ignoring I and W) is below B+. Otherwise the API returns a clear error.                    |
| FR-26 | The app shows attempt history per course, a CGPA summary, credits remaining per category and a retake badge.                                          |

### Inbox and push

| ID    | Requirement                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-27 | A user has an inbox of notifications, newest first, with an unread badge. They can mark one or all read. Nobody can read another user's inbox.                  |
| FR-28 | A user can switch web push on per device (max 5 devices). A push shows a title and link only, built from the notification type, and tapping it opens the inbox. |
| FR-29 | Logging out removes the device's push subscription. A push failure never fails the action that caused it.                                                       |
| FR-30 | An admin can send a test push to their own devices.                                                                                                             |

### Moderation

| ID    | Requirement                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-31 | A user can report a target with a reason. One open report per reporter per target; reports are rate-limited (10 per hour); a user cannot report their own content.                                  |
| FR-32 | A mod can list reports (open first, oldest first) and resolve or dismiss them with a reason.                                                                                                        |
| FR-33 | A mod can search users by username prefix and ban, unban, or issue a temporary password. Banning ends the user's sessions.                                                                          |
| FR-34 | A mod can look up the account holding a 7-digit ID key and release it (the holder is banned, the key is freed). This is the only place a mod sees a student ID, and it is logged.                   |
| FR-35 | Nobody acts on themselves or on an admin. A mod acts on students only. An admin acts on students and mods.                                                                                          |
| FR-36 | An admin can promote a student to mod and demote a mod.                                                                                                                                             |
| FR-37 | Mods only soft-delete. Every mod and automatic action writes an audit row with a before-snapshot and a reason.                                                                                      |
| FR-38 | An admin can view the audit log (filter by actor, target type, target id) and reverse a ban, unban, role change, key release, soft delete, faculty change or course change. A row is reversed once. |

### Content screening and review queue

| ID    | Requirement                                                                                                                                                                                                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-39 | Every user-written post is screened on create and on every edit that changes screened text or photos. The result is `published`, `pending_review` or `rejected`, with a reason category: prohibited item, personal data, scam or spam, abuse or harassment, off-topic, fine.                                                           |
| FR-40 | Deterministic rules run first and reject without calling the model: student IDs (spaces and dashes ignored), card numbers (13 to 19 digits passing Luhn, Bangladeshi phone numbers excluded), links not on the allowlist, malformed contacts, over-long text, banned words, and photos that are not clean WebP within the size limits. |
| FR-41 | The model step sees only post text and photos, never usernames, student IDs, contact details, grades or the routine. A model error, timeout, malformed answer or the daily cap holds the post for review: unscreened text is never published or rejected automatically.                                                                |
| FR-42 | A post that is not published is visible only to its author ("Waiting for a moderator" or the rejection message) and to mods. A rejection shows a category-level message only, never scores or matched text.                                                                                                                            |
| FR-43 | The author of a rejected post can edit and resubmit, or ask a moderator to look (5 asks per hour), which moves it to the review queue.                                                                                                                                                                                                 |
| FR-44 | Three automatic rejections within an hour block the user from posting for one hour and flag them in the mod panel. A mod can clear the flag with a reason; an admin can reverse that.                                                                                                                                                  |
| FR-45 | Mods see held posts and open reports in one queue with its size at the top. A held post shows its text (student IDs and card numbers redacted), the author's username, the model category and confidence, and the rule flags.                                                                                                          |
| FR-46 | A mod approves or rejects a held post (a rejection needs a category and a reason). The mod's decision overrides the model, is decided once even if two mods act together, writes an audit row, and sends the author an inbox message.                                                                                                  |
| FR-47 | Every automatic decision writes an audit row with actor `automod`, the model name, the category, the scores and a redacted text snapshot.                                                                                                                                                                                              |

### Faculty directory

| ID    | Requirement                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-48 | The faculty directory covers every NSU department. Each faculty member has a name, a designation, a department, optional initials and an optional NSU page. Initials are unique across the university without regard to case.                |
| FR-49 | A student picks the faculty member for an attempt from a searchable picker. Search matches the start of any word of the name or the start of the initials, ignoring case, accents and titles such as "Dr."; exact initials rank first.       |
| FR-50 | The picker can be filtered to one department, offers "No faculty", and says "No faculty match that search." when nothing matches. It stays usable with the keyboard.                                                                         |
| FR-51 | A faculty member is shown as "Name (INITIALS)" in the picker and in attempt rows, without brackets when there are no initials. The picker also shows designation and department.                                                             |
| FR-52 | A mod or admin can add and edit faculty (name, initials, designation, department, NSU page) and hide or show a faculty member again with a reason. A taken name (same department) or taken initials is refused with a message on that field. |
| FR-53 | A hidden faculty member is not offered to students, but attempts that already name them keep the name. Every faculty change writes an audit row with a before-snapshot; an admin can reverse an edit, a hide or a show.                      |

### Course management and choice slots

| ID    | Requirement                                                                                                                                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-54 | A mod or admin can pick an imported curriculum (program and version) and see its courses by category, searchable by code or title, with hidden ones behind a "Show hidden" switch and marked "Hidden".                                                                                                                        |
| FR-55 | A mod or admin can add a course or elective placeholder and edit one: code, title, credits (halves allowed), category (existing or new), non-credit, optional semester, "Or take instead" alternatives and prerequisites. A code already used in the curriculum, as a course or an alternative, is refused on the Code field. |
| FR-56 | Prerequisites are written as text such as `CSE215 and (MAT120 or MAT125)` and turned into a rule. A mistake in the text, or a prerequisite on a course the curriculum does not have, is refused on that field with a message.                                                                                                 |
| FR-57 | A mod or admin can hide a course and show it again, each with a reason; nothing is deleted. A hidden course leaves students' course maps, totals, "Unlocked next" and the codes an attempt can name, unless the student already has an attempt on it; their attempts are never deleted and keep counting.                     |
| FR-58 | Every course add, edit, hide and show writes an audit row with a before-snapshot; an admin can reverse an edit, a hide or a show (refused if the old code has been taken since).                                                                                                                                              |
| FR-59 | Importing a curriculum whose program and version already exist replaces every course of that version, including changes made in the Courses screen. The import screen warns about this before the import.                                                                                                                     |
| FR-60 | A course map slot that accepts more than one course shows all its codes joined with "/" until the student has an attempt on one, then shows that course. If several have attempts, the one that counts shows, then the most recent. The same label is used on Home, the course map and the course sheet.                      |

### Class routine

| ID    | Requirement                                                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-61 | A student can add a class to their routine for the current term: a course from their curriculum or own courses, section (1 to 99), one or more days (the NSU day letters S M T W R F A), start and end time in Dhaka time (the end after the start), and optional room and faculty initials as free text.                 |
| FR-62 | A student can edit and delete a class and clear a whole term (after a confirmation). A term holds at most 40 classes.                                                                                                                                                                                                     |
| FR-63 | Two classes on the same day whose times overlap get a warning in the form and on the routine screen, but saving is never blocked. A class that starts exactly when another ends does not overlap.                                                                                                                         |
| FR-64 | Home lists today's classes (today worked out in Asia/Dhaka) in time order, with the class in progress highlighted and finished ones dimmed, and a link to the full week. The summary panel shows the class in progress or the next one today, else the degree standing.                                                   |
| FR-65 | The routine screen is a calendar of the current term with Month, Week and Day views: Week and Day are time grids with clashing classes side by side, Month shows each date's classes, and tapping a date opens it. Dates outside the term have no classes. Tapping an empty slot starts a new class at that day and time. |
| FR-66 | The routine is private to its owner. Every signed-in user, mods and admins included, has their own routine; nobody can read or change another user's, and another user's class is not found. The routine is never sent to a model, used for notifications or shown to anyone else. Entry is manual only.                  |

## 4. Non-functional requirements

| ID    | Requirement                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-1 | Mobile-first: every screen works at 390px width and on desktop at 1440px, with touch-sized controls.                                       |
| NFR-2 | Contrast: body text 4.5:1, large text and control borders 3:1, on every palette ([`contrast-check.md`](contrast-check.md)).                |
| NFR-3 | Passwords are PBKDF2-SHA-256 with a per-user salt; only a hash of the session token is stored; cookies are HttpOnly, Secure, SameSite=Lax. |
| NFR-4 | Every list endpoint is paginated and filtered columns are indexed, to stay inside the D1 free-tier row-read limit.                         |
| NFR-5 | Times are stored as UTC epoch ms; "today", terms and windows are computed in Asia/Dhaka.                                                   |
| NFR-6 | Tests never touch the network; external services sit behind adapters with fakes.                                                           |
| NFR-7 | Bangla text renders in Noto Sans Bengali.                                                                                                  |
| NFR-8 | The app runs on one Cloudflare Worker with D1 and needs no paid service for a student-sized user base.                                     |

## 5. Constraints and accepted risks

- Email is format-checked, not verified. Mitigations: unique ID key, signup limits, posting cooldown, mod ID-conflict tool.
- The student ID check rejects obviously fake IDs; it does not prove ownership.
- No dark mode follows the OS; Night is a manual palette.
- The faculty list starts from the public ECE department listing (2026-10-20); other departments are imported later and moderators can fix entries in the panel. Scholar, ORCID and OpenAlex IDs are added with faculty profiles.
- Screening runs a stub model step (approves text, holds photos) until the real model is wired in; no post type ships yet, so FR-39 to FR-47 are exercised by tests and the forced-review flag.
- Curricula exist for 13 undergraduate programs; graduate programs are out of scope.

## Planned

Resource sharing, rides, lost and found, marketplace, faculty profiles and research sync. See `build_plan_pwa.md` phases 10 onward.
