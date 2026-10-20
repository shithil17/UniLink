# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

NSU undergraduate students from every program, using the app mostly on their phones between classes, on campus and while commuting. Their jobs: plan the degree (course map, prerequisites, CGPA, retakes), know today's classes, and trade help with other students (notes and resources, rides, lost and found, second-hand items). CSE students get extras: faculty research profiles and the supervisor finder.

Secondary users: student moderators (reports, review queue, curriculum import) and admins (mods, reversing logged actions). Both work in the same app.

## Product Purpose

One installable app that replaces the scattered spreadsheets, Facebook groups and WhatsApp chats students use today for degree planning and campus exchange. Success means a student opens it daily for their routine and course progress and trusts it for posts to and from other students.

## Positioning

Unofficial and student-run. Built around NSU's own course maps, grading and ID format, with moderation done by students. No official university portal or general marketplace can offer this.

## Operating Context

- Installed as a PWA ("Add to Home Screen") on Android and iOS. Also used in a desktop browser.
- Data is always fetched live. Offline shows only a "You are offline" screen.
- Times and "today" follow Asia/Dhaka.
- Contacts open the dialer, WhatsApp or Messenger directly (`tel:`, `wa.me`, `m.me`).

## Capabilities and Constraints

- Features: course map and prerequisites, attempts, CGPA and retakes, class routine, notification inbox, resource sharing, faculty profiles and AI supervisor finder (CSE), rides, lost and found, marketplace, moderation and audit.
- Every user post is screened automatically and can be held for a mod. Moderation states are shown persistently (`StatusNote`), never only in a toast.
- Privacy: student IDs are never shown publicly, only usernames. Contact details appear only after an explicit, rate-limited reveal.
- AI output is never shown as free text. Replies are built by the server from validated data.
- Feedback rules: toast for every action result and error (no inline message boxes), inline text only for per-field validation, `StatusNote` for moderation states, inbox for anything seen later.
- Users choose a color theme in Settings from several palettes.

## Brand Commitments

- Name: **UniLink**.
- Clearly unofficial: no NSU colors, crest or logo-like marks, and nothing that suggests university endorsement.
- Voice: a friendly peer. Plain, warm and a bit informal, written by students for students, never cutesy.

## Evidence on Hand

- Real NSU curricula for 13 programs in `data/curricula/`.
- No testimonials, usage numbers or endorsements exist. Do not invent any.

## Product Principles

1. Daily utility first: the things a student checks every day (today's classes, course status) are the fastest to reach.
2. Trust is visible: moderation state, expiry and privacy limits are stated plainly where they apply.
3. Private by default: nothing identifying or contact-related shows without a deliberate action.
4. One app, many programs: no screen assumes the student is in CSE unless the feature is CSE-only.

## Accessibility & Inclusion

Body text has at least 4.5:1 contrast. Large text and controls have at least 3:1, on every palette, including on primary buttons and hero surfaces. Touch-sized targets, and everything works with the keyboard.
