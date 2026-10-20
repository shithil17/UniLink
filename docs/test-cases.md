# Manual test cases (Phases 0 to 9, the faculty directory and course management)

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

## I. Faculty directory (FR-48 to FR-53)

Needs the faculty seeded (`vp run seed` locally; for staging see `docs/data-formats.md`). Use a mod M, an admin A and a student S with a course open in Courses.

| ID   | Steps                                                                                       | Expected                                                                                                 | Result |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| I-1  | S: open a course, "Add term and faculty", tap the Faculty field                             | A sheet "Who taught it?" opens with the search box focused, "No faculty" first and the list below        |        |
| I-2  | Type `rahman`                                                                               | Only people with a name word starting "rahman"; each row shows "Name (INITIALS)" and a muted line        |        |
| I-3  | Type `atiq rah`                                                                             | Both Atiqur Rahman entries                                                                               |        |
| I-4  | Type `rkz`, then `RKZ`                                                                      | The same single person, first in the list                                                                |        |
| I-5  | Type `sfr`, then `sfr1`                                                                     | `sfr` lists every code starting with it; `sfr1` lists exactly that person                                |        |
| I-6  | Type `dr nova`                                                                              | Finds Nova Ahmed (the title is ignored)                                                                  |        |
| I-7  | Type `zzzz`                                                                                 | "No faculty match that search."                                                                          |        |
| I-8  | Filter to one department, then back to "All departments"                                    | The list narrows to that department and widens again; the search text is kept                            |        |
| I-9  | With the keyboard: type, Arrow Down, Enter                                                  | The highlighted row is chosen and the sheet closes; the field shows "Name (INITIALS)"                    |        |
| I-10 | Choose "No faculty"                                                                         | The field shows "No faculty"; saving works                                                               |        |
| I-11 | Save the attempt with a faculty member                                                      | The attempt row shows "Name (INITIALS)"; a person without initials shows the name only                   |        |
| I-12 | Use a phone-width window                                                                    | Rows are at least 44px tall; the sheet scrolls inside; the keyboard does not hide the search box         |        |
| I-13 | Block `/api/faculty` in DevTools and open the form                                          | The Faculty field is disabled and a toast says "The faculty list did not load. You can save without it." |        |
| I-14 | M: Moderation > Faculty                                                                     | All faculty are listed with the same search and department filter; hidden ones are not shown             |        |
| I-15 | M: Add faculty with a name, initials `TsT1`, designation, department                        | Toast "Faculty added"; S finds the person in the picker                                                  |        |
| I-16 | M: add another with initials `tst1`                                                         | The Initials field says another faculty member already has them; nothing is added                        |        |
| I-17 | M: add the same name in the same department with other initials                             | The Name field says it is already listed; the same name in another department is accepted                |        |
| I-18 | M: add with an NSU page `http://example.com/x`, then `https://ece.northsouth.edu/people/x/` | The first is refused (an https link on northsouth.edu); the second is accepted                           |        |
| I-19 | M: edit the designation of a person                                                         | Toast "Faculty updated"; S sees the new designation after reloading                                      |        |
| I-20 | S has an attempt naming P. M hides P with the reason "left NSU"                             | Toast "Faculty hidden"; P is gone from S's picker, but S's attempt row still shows P's name              |        |
| I-21 | M: turn on "Show hidden"                                                                    | P appears with a "Hidden" badge; open P, "Show again" with a reason: toast "Faculty shown again"         |        |
| I-22 | M: hide without a reason                                                                    | The reason field shows an error; nothing changes                                                         |        |
| I-23 | S opens `/mod/faculty` or calls `/api/mod/faculty`                                          | Redirected away / 403                                                                                    |        |
| I-24 | A: audit log, filter target type `faculty`                                                  | A row for each of I-15, I-19, I-20, I-21 with the faculty name; edit and hide rows can be reversed       |        |
| I-25 | A: reverse the edit from I-19                                                               | The old designation is back; the reversal is logged                                                      |        |
| I-26 | Seed twice, after M added initials to a person who has none in the file                     | No duplicates; the initials M added and any hidden flag are kept                                         |        |

## J. Course management and choice slots (FR-54 to FR-60)

Use a mod M, an admin A, and a CSE (`42`) student S whose curriculum version is imported. S has no attempt on `ENG115` or `BEN205` to start with.

| ID   | Steps                                                                                                                      | Expected                                                                                                                             | Result |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| J-1  | M: Moderation > Courses                                                                                                    | A curriculum picker (program and version) and the courses of the first one, grouped by category; Courses is in the mod nav           |        |
| J-2  | Search `ben205`, then `composition`, then `zzzz`                                                                           | The slot with that alternative; the slot with that title; "No courses found"                                                         |        |
| J-3  | M: Add course `CSE499`, title "Capstone", credits 1.5, category Major Core, prerequisite `CSE225 and 90 credits completed` | Toast "Course added"; it is last in its category. S sees it on the next load of Courses, locked until the prerequisite is met        |        |
| J-4  | M: add another course with code `CSE115` (an existing slot), then one with `BEN205` (an alternative)                       | Under Code: another course already uses it. Nothing is added                                                                         |        |
| J-5  | M: add a course whose prerequisite is `CSE115 and CSE17`                                                                   | Under Prerequisites: `CSE17` isn't a course code. Nothing is added                                                                   |        |
| J-6  | M: prerequisite `CSE115 or CSE999` (a course the curriculum doesn't have)                                                  | Under Prerequisites: `CSE999` isn't another course in this curriculum. Nothing is added                                              |        |
| J-7  | M: prerequisite `CSE115 and (MAT120 or MAT125) and`, then `(CSE115`, then `and CSE115`                                     | Each shows a plain message under Prerequisites saying what is wrong and where                                                        |        |
| J-8  | M: edit a title and add an "Or take instead" pair; remove another pair; save                                               | Toast "Course updated"; the row, S's map and the sheet show the change after a reload                                                |        |
| J-9  | M: edit a course and change nothing, save                                                                                  | The sheet closes; no audit row is written                                                                                            |        |
| J-10 | M: change a course's code to one used elsewhere                                                                            | Under Code: another course already uses it                                                                                           |        |
| J-11 | M: change the code of a course another course lists as a prerequisite                                                      | Under Code: that course lists it as a prerequisite; change that first. Nothing changes                                               |        |
| J-12 | M: hide a course S has no grade on, without a reason; then with "Dropped from the curriculum"                              | The reason field shows an error; then toast "Course hidden". S no longer sees it on Courses, Home "Unlocked next" or in totals       |        |
| J-13 | S: try to record a grade for the hidden course's code                                                                      | Refused: the course is not in S's curriculum                                                                                         |        |
| J-14 | M: hide a course S has a grade on                                                                                          | S still sees it, with the grade; S's CGPA and credits are unchanged; nothing is deleted                                              |        |
| J-15 | M: turn on "Show hidden"                                                                                                   | Hidden courses appear with a "Hidden" badge; "Show again" with a reason gives the toast "Course shown again"; S sees it again        |        |
| J-16 | M: hide a course another course needs as a prerequisite                                                                    | The sheet warned that dependants stay locked; S sees the dependant locked until its prerequisite is changed                          |        |
| J-17 | A: audit log, target type `course`                                                                                         | A row for each of J-3, J-8, J-12, J-15 naming the course; edit and hide rows can be reversed                                         |        |
| J-18 | A: reverse the edit from J-8, then the hide from J-12                                                                      | The old values are back and S's map follows; both reversals are logged                                                               |        |
| J-19 | M renames a course to `XYZ101`; M adds a new `OLD101` with the old code; A reverses the rename                             | Refused: something else has taken those values since                                                                                 |        |
| J-20 | S opens `/mod/courses` or calls `/api/mod/curricula`                                                                       | Redirected away / 403                                                                                                                |        |
| J-21 | M: Import screen, pick a file whose program and version are already imported                                               | A note: "Importing replaces every course of this version, including changes made in the Courses screen." A new version shows no note |        |
| J-22 | M: import that file; open Courses                                                                                          | Every course is as in the file: J-3 and J-8 changes and hides are gone                                                               |        |
| J-23 | S (no attempt on `ENG115` or `BEN205`): open Courses and Home, at 390px                                                    | The slot reads `ENG115/BEN205` over "Introduction to Composition / Bangla Language", wrapping without cutting off a code             |        |
| J-24 | S: open that slot                                                                                                          | The header shows both codes and titles; "Or take instead" lists the alternative(s)                                                   |        |
| J-25 | S: record a grade on `BEN205`                                                                                              | The row, Home (if listed) and the sheet header show `BEN205` and its title; the sheet lists "Other choices for this slot"            |        |
| J-26 | S: record a passing grade on `ENG115` too                                                                                  | The course that counts shows (the better best grade; equal grades show the most recent)                                              |        |
| J-27 | S: a slot with a lab alternative (for example a `...L` course with an alternative)                                         | Shows its codes joined with "/" and behaves as J-23 to J-26                                                                          |        |

## K. Class routine (FR-61 to FR-66)

Use a CSE (`42`) student S with a curriculum, a second student S2, and a mod M. Run on a phone (390px) for K-8 to K-12. "Today" means the current day in Dhaka.

| ID   | Steps                                                                                            | Expected                                                                                                                                  | Result |
| ---- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| K-1  | S: open the Routine tab with no classes                                                          | Every day from Sunday shows "No classes"; the intro text and "Add class" show; no "Clear this term"                                       |        |
| K-2  | S: Add class: CSE115, section 2, days S and T, 08:00 to 09:30, room `NAC 501`, faculty `RkZ`     | Toast "Class added"; it shows under Sunday and Tuesday with "Section 2 · Room NAC 501 · RkZ"                                              |        |
| K-3  | S: Add class with no days, then with no times, then ending before it starts                      | "Pick at least one day"; "Pick a start time" / "Pick an end time"; "The class must end after it starts". Nothing is saved                 |        |
| K-4  | S: add a class on S from 09:00 to 10:30                                                          | Before saving the sheet warns "This overlaps another class. You can still save it." naming CSE115; saving works; both rows say "Overlaps" |        |
| K-5  | S: add a class on S from 09:30 to 11:00 after deleting the K-4 class                             | No overlap warning (touching times are not a clash)                                                                                       |        |
| K-6  | S: edit the K-2 class to section 3; then delete a class                                          | Toast "Class updated"; the delete asks first, then toast "Class deleted"                                                                  |        |
| K-7  | S: the Course picker                                                                             | Lists S's curriculum courses and own courses; no course from another program                                                              |        |
| K-8  | S: add classes for today at three times, one that has finished, one on now, one later; open Home | "Today" lists them in time order: finished one in faint ink, the current one on a tinted row marked "Now", the later one plain            |        |
| K-9  | S: look at the Home summary panel during the current class, then between classes                 | "In class now" with the minutes left; then "Next class" with the minutes until it starts, the course and the room                         |        |
| K-10 | S: Home after the last class of the day (or on a day with no classes)                            | The panel shows the degree standing; Today says "No classes today."                                                                       |        |
| K-11 | Set the phone to a time zone other than Dhaka (for example London) and reopen Home               | Today is still Dhaka's weekday and the current/finished states follow Dhaka time                                                          |        |
| K-12 | Around 00:00 Dhaka (18:00 UTC), open Home just before and just after                             | Just after midnight Today shows the new day's classes                                                                                     |        |
| K-13 | S: Clear this term, choose "Keep them", then again "Clear routine"                               | Nothing changes the first time; then toast "Routine cleared" and every day shows "No classes"                                             |        |
| K-14 | S2: open Routine                                                                                 | Only S2's own classes; none of S's                                                                                                        |        |
| K-15 | M: look for a Routine tab, then tap "Full routine" on Home and add a class                       | No Routine tab (Mod is there instead); the routine opens and M's class saves; M sees none of S's classes, and S sees none of M's          |        |
| K-16 | S: check the inbox and any push after adding classes                                             | No notification mentions the routine                                                                                                      |        |
