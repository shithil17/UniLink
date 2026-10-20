# Manual test cases (Phases 0 to 8)

Run on staging unless a case says otherwise. Each case cites the requirement in [`srs.md`](srs.md). Record Pass/Fail and the build date in the Result column; log failures in the defect report.

Test accounts: use the seeded students from `vp run seed` (never real student IDs) and the seeded admin. Create a mod by promoting a seeded student as the admin.

Valid sample IDs below use the 2022 intake; replace `22` with a year within 8 years of today if needed. Program `42` is CSE.

## A. Sign up and ID format (FR-1 to FR-3, FR-7)

| ID   | Steps                                                                    | Expected                                                       | Result |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ------ |
| A-1  | Sign up with valid fields and ID `2211234042`                            | Account created, signed in, Home opens                         |        |
| A-2  | Same with ID `2211234642` (verification digit 6) after A-1 is cleaned up | Accepted; same 7-digit key `2211234`                           |        |
| A-3  | Enter ID with spaces/dashes: `221 1235 042`, `221-1236-042`              | Accepted as `2211235042` and `2211236042`                      |        |
| A-4  | Semester digit 0 or 4: `2201237042`, `2241237042`                        | "Enter a valid NSU student ID"                                 |        |
| A-5  | Verification digit 3: `2211238342`                                       | Rejected                                                       |        |
| A-6  | Unknown program code: `2211239099`                                       | Rejected                                                       |        |
| A-7  | Wrong length: 9 and 11 digits                                            | Rejected                                                       |        |
| A-8  | Admission year in the future; year more than 8 years ago                 | Rejected                                                       |        |
| A-9  | Second account with an ID sharing the first 7 digits of A-1              | "This ID is already registered, contact a mod"; no account     |        |
| A-10 | Username `ab`, 21 characters, `Has Space`, `UPPER`                       | Short/long/space rejected; `UPPER` is saved as `upper`         |        |
| A-11 | Email `x@gmail.com`, `x@cs.northsouth.edu`, `x@northsouth.edu.evil.com`  | All rejected; `X@NorthSouth.edu` accepted and saved lowercase  |        |
| A-12 | Duplicate username (any case) or duplicate email                         | Rejected                                                       |        |
| A-13 | Password of 7 characters; of 129 characters                              | Rejected; 8 and 128 accepted                                   |        |
| A-14 | Full name ` Rahim   Uddin` and a 1-character name                        | Saved as `Rahim Uddin`; 1 character rejected                   |        |
| A-15 | Inspect every API response and screen for the new user                   | No student ID, email or full name visible to any other account |        |
| A-16 | Make 6 signups from one network within an hour                           | The 6th is refused (429)                                       |        |

## B. Log in, log out, change password (FR-4 to FR-6, FR-9)

| ID   | Steps                                                           | Expected                                                       | Result |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| B-1  | Log in with correct credentials (username in mixed case)        | Signed in                                                      |        |
| B-2  | Log in with a wrong password                                    | Generic error, no hint which field                             |        |
| B-3  | Ten wrong logins in 15 minutes, then the right password         | Eleventh attempt refused (429) until the window passes         |        |
| B-4  | Log out in Settings, press Back                                 | Login screen; protected screens redirect to login              |        |
| B-5  | Inspect cookies in DevTools                                     | Session cookie is HttpOnly, Secure, SameSite=Lax               |        |
| B-6  | Log in as the seeded admin                                      | Forced to the change-password screen; other routes unreachable |        |
| B-7  | Complete the forced change with a valid new password            | Flag cleared, app opens normally                               |        |
| B-8  | Change password from Settings with a wrong current password     | Refused                                                        |        |
| B-9  | Change password while signed in on two browsers                 | The other browser's session no longer works                    |        |
| B-10 | A banned user (see F-1) tries to log in and uses an old session | Refused both ways                                              |        |
| B-11 | A new account (under 24 hours old) tries any posting feature    | Blocked by the cooldown (when a posting feature exists)        |        |

## C. App shell, install and palettes (FR-11 to FR-15, NFR-1, NFR-7)

| ID   | Steps                                                                          | Expected                                                      | Result |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------ |
| C-1  | Android Chrome: open the staging URL, Add to Home Screen, launch from the icon | Opens standalone with the app name and icon                   |        |
| C-2  | iOS Safari: open the URL                                                       | One-time "Add to Home Screen" hint appears                    |        |
| C-3  | Dismiss the hint, reload                                                       | Hint does not return                                          |        |
| C-4  | iOS: Add to Home Screen, launch it                                             | Standalone, no hint                                           |        |
| C-5  | Installed app on each platform: turn on airplane mode, launch                  | "You are offline" screen with a retry button                  |        |
| C-6  | From C-5 turn the network on, tap retry                                        | App loads                                                     |        |
| C-7  | Deploy a new build, relaunch the installed app                                 | "Update available, reload" toast; reload shows the new build  |        |
| C-8  | DevTools > Application > Cache Storage                                         | No `/api` response is cached                                  |        |
| C-9  | Resize to 360px and 390px, then 1440px on every main screen                    | No overlap or clipped text; desktop uses the wider layout     |        |
| C-10 | Settings: pick each of the five palettes, restart the installed app            | Choice kept; no flash of Ocean Teal; status bar color matches |        |
| C-11 | Private browsing (storage blocked)                                             | App works and falls back to Ocean Teal                        |        |
| C-12 | Show Bangla sample text (e.g. in copy or a student course title)               | Renders in Noto Sans Bengali, no tofu boxes                   |        |

## D. Course map (FR-16 to FR-22)

| ID   | Steps                                                                                               | Expected                                                                                | Result |
| ---- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| D-1  | Sign in as a seeded CSE (`42`) student, open Courses                                                | Map grouped by category with credit totals                                              |        |
| D-2  | Compare 10 random courses, their credits, prerequisites and categories against the official CSE map | All match (D to sign off per program; see `data-formats.md`)                            |        |
| D-3  | Open a locked course                                                                                | Prerequisite list shown; cannot be marked done by mistake                               |        |
| D-4  | Record a passing grade for a prerequisite from the map                                              | Course turns done; dependants move from locked to available                             |        |
| D-5  | Record F, then I, then W for a course                                                               | None marks it done                                                                      |        |
| D-6  | Mark a course waived                                                                                | Shown "Waived", credits earned, CGPA unchanged                                          |        |
| D-7  | Add a student course to fill an elective slot                                                       | Slot shows the course; totals update                                                    |        |
| D-8  | Add a course with a code already in the curriculum                                                  | Refused (code taken)                                                                    |        |
| D-9  | Add courses until credits exceed the degree total                                                   | Totals show e.g. 136 / 130, no block                                                    |        |
| D-10 | Mark that course excluded                                                                           | Badge "Excluded"; totals, prerequisites and CGPA drop it                                |        |
| D-11 | Try to exclude a curriculum course                                                                  | Not offered                                                                             |        |
| D-12 | Add the 41st student course                                                                         | Refused with the limit message                                                          |        |
| D-13 | Sign in as a student whose program has no curriculum                                                | Empty state, no error                                                                   |        |
| D-14 | As a mod, import a valid curriculum JSON, then one with a bad row                                   | Valid rows imported; bad row listed with reason; file with no valid row changes nothing |        |
| D-15 | As a student, open the import screen or call the import API                                         | 403                                                                                     |        |
| D-16 | Two students open the app; one adds attempts                                                        | The other sees none of them                                                             |        |

## E. Attempts and CGPA (FR-23 to FR-26)

| ID   | Steps                                                                               | Expected                                                | Result |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| E-1  | Add an attempt: course, A-, Fall 2023, a faculty member                             | Saved; appears in history                               |        |
| E-2  | Add an attempt without a term from the full form                                    | Term required                                           |        |
| E-3  | Add a second attempt for a course whose best grade is B+                            | Refused: retake not allowed                             |        |
| E-4  | Same with best grade B                                                              | Allowed; retake badge was shown before                  |        |
| E-5  | Course with F then B: check CGPA                                                    | Uses B (best); credits counted once                     |        |
| E-6  | Course with only W or only I                                                        | Not in CGPA, no credits                                 |        |
| E-7  | Course with only F                                                                  | CGPA counts 0.0, no credits earned                      |        |
| E-8  | Edit an attempt so it would break the retake rule                                   | Refused with a clear error                              |        |
| E-9  | Delete an attempt                                                                   | CGPA, credits and map status update                     |        |
| E-10 | Enter a transcript for a seeded student; D computes CGPA by hand with the NSU scale | App CGPA equals the hand calculation to 2 decimals      |        |
| E-11 | Credits remaining per category                                                      | Equals category total minus earned credits              |        |
| E-12 | As a mod or admin, try to read another student's attempts or CGPA                   | No route exposes them; another user's attempt id is 404 |        |

## F. Mod panel (FR-31 to FR-38)

Use three accounts: a mod M, a student S and the admin A. S is a seeded student.

| ID   | Steps                                                                                     | Expected                                                            | Result |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| F-1  | M: Users, search S by the first 2+ letters of the username, Ban with reason "test"        | S shown banned; S's sessions end; audit row exists                  |        |
| F-2  | M: ban S again                                                                            | 409 already banned                                                  |        |
| F-3  | M: Ban with a 2-character reason                                                          | Rejected (reason 3 to 300 characters)                               |        |
| F-4  | M: Unban S                                                                                | S can log in again; audit row exists                                |        |
| F-5  | M: search with 1 character                                                                | Rejected or no search (minimum 2)                                   |        |
| F-6  | M: user list                                                                              | Shows handle and state only; no ID, email or name                   |        |
| F-7  | M: Reset password for S                                                                   | Temporary password shown once; reload does not show it again        |        |
| F-8  | S: log in with the temporary password                                                     | Forced to change password; other routes blocked until done          |        |
| F-9  | M: try ban, reset or role change on A, on another mod, on self                            | 403 forbidden_target                                                |        |
| F-10 | M: ID conflict, look up S's 7-digit key                                                   | Holder handle and state shown; the lookup is in the audit log       |        |
| F-11 | M: release the key with a reason                                                          | Holder banned; a new signup with that ID now works                  |        |
| F-12 | S files a report on content; M opens Reports                                              | Report listed, oldest open first                                    |        |
| F-13 | S reports the same target twice                                                           | 409 already reported                                                |        |
| F-14 | S reports their own content                                                               | Refused                                                             |        |
| F-15 | S files 11 reports within an hour                                                         | The 11th is refused (429)                                           |        |
| F-16 | M: resolve one report, dismiss another, each with a note                                  | Status changes; audit rows exist; resolving again is 409            |        |
| F-17 | S opens `/mod` screens or calls a mod API                                                 | 403                                                                 |        |
| F-18 | M calls an admin API (role change, audit, reverse)                                        | 403; the audit tab is not shown to mods                             |        |
| F-19 | A: promote S to mod, then demote                                                          | Role changes both ways; audit rows exist                            |        |
| F-20 | A: Audit log, filter by actor, then by target                                             | Rows filter correctly; no snapshot in the response                  |        |
| F-21 | A: reverse the ban from F-1 (re-ban S first if needed)                                    | S is unbanned; a new reversal row links to the original             |        |
| F-22 | A: reverse the same row again                                                             | 409 already reversed                                                |        |
| F-23 | A: reverse a password reset, a report resolution, an ID lookup, a reversal row            | 409 not reversible                                                  |        |
| F-24 | A: reverse a key release after the real owner has signed up                               | 409 key in use                                                      |        |
| F-25 | A: reverse a soft delete (needs a content type registered for soft delete; see plan note) | Content restored; reversal logged                                   |        |
| F-26 | Every F case that changes state                                                           | An audit row exists with actor, action, target, reason and snapshot |        |

## G. Inbox and push (FR-27 to FR-30)

| ID   | Steps                                                                                     | Expected                                            | Result |
| ---- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| G-1  | Receive a notification (admin test push also creates none in the inbox; use a real event) | Row shows in Inbox, unread badge increments         |        |
| G-2  | Open Inbox, mark one read, then Mark all read                                             | Badge decrements to 0                               |        |
| G-3  | Call `POST /api/inbox/:id/read` with another user's id                                    | 404                                                 |        |
| G-4  | Settings: switch Notifications on (Android Chrome, allow permission)                      | Switch on; device subscribed                        |        |
| G-5  | As admin, Settings > Send test                                                            | Push arrives on that device; tapping opens Inbox    |        |
| G-6  | Same on iOS after Add to Home Screen                                                      | Same                                                |        |
| G-7  | iOS in Safari (not installed)                                                             | Switch explains the install requirement             |        |
| G-8  | Block the permission in browser settings, return to Settings                              | Switch shows the blocked state                      |        |
| G-9  | Log out on that device, then send another test push from a second device                  | No push on the logged-out device                    |        |
| G-10 | Subscribe a 6th device                                                                    | Refused with the device limit message; none dropped |        |
| G-11 | Read the push text                                                                        | Title and link only; no names, no payload text      |        |
| G-12 | Push secrets unset (local)                                                                | Switch hidden or off; no crash                      |        |

## H. Screening and review queue (FR-39 to FR-47)

Needs a post type registered for screening (rides is the first). Until then, run the server-side cases through `vp test moderation`. For H-9 to H-16, set `SCREEN_FORCE_REVIEW=1` on staging (or in `.dev.vars`) so every post that passes the rules is held, and remove it afterwards. Use a mod M and two students S and T.

| ID   | Steps                                                                  | Expected                                                                                    | Result |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| H-1  | S posts text containing a valid student ID written as `221 1234 042`   | Rejected; S sees the personal-data message; no ID in any response                           |        |
| H-2  | S posts text with a test card number `4111 1111 1111 1111`             | Rejected with the personal-data message                                                     |        |
| H-3  | S posts "call me on +880 1712 345678"                                  | Not flagged for a phone number                                                              |        |
| H-4  | S posts a link to an unknown site, then a link to `github.com`         | The first is rejected (scam or spam); the second passes the rules                           |        |
| H-5  | S posts text over the length limit                                     | Rejected (off-topic message)                                                                |        |
| H-6  | S posts text with a banned phrase, in mixed case                       | Rejected with that phrase's category                                                        |        |
| H-7  | S posts clean text with the flag off                                   | Published at once (stub model)                                                              |        |
| H-8  | S posts clean text with a photo, flag off                              | Held: "Waiting for a moderator"                                                             |        |
| H-9  | S posts clean text with the flag on                                    | Held: S sees "Waiting for a moderator"                                                      |        |
| H-10 | T opens the feed and the held post's link                              | T cannot see it (404 or absent)                                                             |        |
| H-11 | M opens Moderation > Queue                                             | The post is listed with S's username, category, confidence, flags; the queue size counts it |        |
| H-12 | M approves it                                                          | Post published; T can see it; S gets "Your post is live" in the inbox; audit row exists     |        |
| H-13 | Another held post: M rejects with category "scam or spam" and a reason | S gets the scam-or-spam message, not M's reason; audit row has the reason                   |        |
| H-14 | Two mods approve the same held post at once                            | One succeeds; the other gets "Another moderator already decided that post"                  |        |
| H-15 | S taps "Ask a moderator to look" on a rejected post                    | Post shows in the queue marked as asked; any student ID in it shows as `[redacted]` to M    |        |
| H-16 | S asks a moderator 6 times within an hour (different posts)            | The 6th is refused                                                                          |        |
| H-17 | S edits a published post to add a student ID                           | The edit is screened again and rejected                                                     |        |
| H-18 | S gets 3 automatic rejections within an hour, then posts clean text    | Refused with a cooldown for about an hour; M sees S flagged in Users with the cooldown      |        |
| H-19 | M clears S's flag with a reason                                        | Flag and cooldown cleared; S can post; audit row exists                                     |        |
| H-20 | A reverses the clear from H-19                                         | Flag and cooldown are back; reversal logged                                                 |        |
| H-21 | S opens `/mod/queue` or calls `/api/mod/queue`                         | 403                                                                                         |        |
| H-22 | A: audit log, filter by actor `automod`                                | One row per automatic decision with model name, category and a redacted text snapshot       |        |
