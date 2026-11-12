# Resource sharing flow (sequence diagrams)

Covers material requests and the links sent to them. Code: `src/server/features/resources/` (routes, `announce.ts`, `postTypes.ts`), `src/server/repos/resources.ts`, `src/server/cron.ts`, `src/shared/resourceUrl.ts`. Links only: UniLink hosts no files.

Both a request and a link are user-written posts, so each goes through `submitPost()` and `screen()` (see [`screening-flow.md`](screening-flow.md)). The URL itself is checked by one shared rule (`resourceUrl.ts`, used by the form and again by the server): a full `https` link to a public website, with link shorteners and private or numeric hosts refused.

## Request, notification and link

```mermaid
sequenceDiagram
  actor Req as Requester
  participant API as Worker API
  participant Scr as screen()
  participant Mod as Moderator
  participant Inbox as notify()
  actor Help as Helper

  Req->>API: Post a request (course, faculty or both, note, expiry)
  API->>API: Rate limit, expiry range, open-request cap, new-account wait
  API->>Scr: Screen the note
  Scr-->>API: published, pending_review or rejected
  alt published
    API->>Inbox: Fan-out to students whose attempt matches every field set
    Inbox-->>Help: Notification with the request id only
  else pending_review
    API-->>Req: Waiting for a moderator (only the requester sees it)
    Mod->>API: Approve the held request
    API->>Inbox: Fan-out, now
    Inbox-->>Help: Notification with the request id only
  else rejected
    API-->>Req: Category message, nothing is sent
  end

  alt Helper opens the notification
    Help->>API: Open the request screen
  else Helper uses the Help others tab
    Help->>API: List open requests for any course they recorded, any faculty
    API-->>Help: Rows, Same faculty first, no requester and no link
    Help->>API: Open one
  end

  Help->>API: Send a link (a safe https link) and an optional note
  API->>API: Rate limit, own request, still open, per-user and per-request caps, new-account wait
  API->>Scr: Screen the note
  Scr-->>API: published, pending_review or rejected
  alt published
    API->>Inbox: Tell the requester a link arrived
    Inbox-->>Req: Notification, opens My requests
  else pending_review
    API-->>Help: Waiting for a moderator
    Mod->>API: Approve the held link
    API->>Inbox: Tell the requester
  end
  Req->>API: My requests
  API-->>Req: Link, sender username and same-faculty line (only here)
```

Who is told: every student whose attempts match **every field the request sets** (the course, the faculty member, or both on the same attempt), once each, excluding the requester and banned users, up to `limits.resourceFanoutMax`. The requester is never told who or how many. Help others works the other way round: it lists open requests when the helper looks, so a course recorded after the request was posted still shows it. Notifications are not sent again.

## Accept, turn down, report

```mermaid
sequenceDiagram
  actor Req as Requester
  participant API as Worker API
  participant Inbox as notify()
  actor Up as Uploader
  participant Q as Mod queue
  actor Mod as Moderator

  alt Accept
    Req->>API: Accept a link (after a confirm sheet)
    API->>API: One guarded update: still open, theirs, link published and live
    API-->>Req: Request fulfilled, no more links accepted
    API->>Inbox: Tell the uploader
    Inbox-->>Up: Your link was accepted
  else Turn down
    Req->>API: Turn a link down
    API-->>Req: Link marked Turned down, it stops counting toward the caps
  else Report
    Req->>API: Report a link or a request, with a reason
    API->>Q: Open report (one open report per reporter and target, 10 reports an hour)
    Mod->>Q: Resolve or dismiss with a note, audited
  end
```

Taking content down is a soft delete with an audit row (`softDelete()` in `src/server/softDelete.ts`); an admin can reverse it, and the row is never hard-deleted by a mod. The report row in the queue offers only Mark handled and Dismiss so far: there is no button that calls `softDelete()` yet.

The uploader is not told when a link is turned down. A helper who has opened a request can also report it from the request screen. Only the requester can report a link, and only once it is published; a request is reportable by anyone who can see it.

## Expiry and purge

```mermaid
sequenceDiagram
  participant Cron as Cron, 03:00 Dhaka
  participant DB as D1
  participant Audit as audit()

  Cron->>DB: Delete open requests whose expiry has passed, with their links
  DB-->>Cron: n rows
  opt n is more than 0
    Cron->>Audit: actor system, job name, removed n rows
  end
  Cron->>DB: Delete fulfilled requests accepted more than 90 days ago, with their links
  DB-->>Cron: n rows
  opt n is more than 0
    Cron->>Audit: actor system, job name, removed n rows
  end
```

- **Expiry.** The requester picks it (1, 3, 7, 14 or 30 days; the server accepts 1 hour to 60 days). A request past its expiry is shown as expired and takes no links straight away, before the cron removes it. It also drops out of Help others and stops being visible to everyone but its requester.
- **After accepting.** A fulfilled request and its links stay for 90 days (shown as "3 months" in the screens), so the requester can save what they need. Then the cron deletes them.
- **Schedule.** The cron trigger is `0 21 * * *` in UTC, which is 03:00 in Asia/Dhaka. Hard deletion happens only here; mods only soft-delete.
- **Held and rejected requests** that pass their expiry are deleted too: the first job removes every unfulfilled request past its expiry, whatever its screening status.
