# Post screening flow (activity diagrams)

Covers content screening and the review queue. Every user-written post (rides, lost and found, marketplace, resource requests and submissions) goes through these flows on create **and** on any edit that changes screened text or photos. Code: `src/server/moderation/` (`submitPost()`, `screen()`, `runRules()`, `askModerator()`) and `src/server/features/mod/` (`modQueue()`, `decidePost()`).

Statuses on every post: `published`, `pending_review`, `rejected`. A post that is not published is visible only to its author and to mods. Every automatic decision writes an audit row with actor `automod`.

## Submit or edit a post

```mermaid
flowchart TD
  A([Student submits or edits a post]) --> B{Account older than the new-account wait?}
  B -- no --> X1[/429 new_account: nothing saved/]
  B -- yes --> C{Posting cooldown active?}
  C -- yes --> X2[/429 cooldown: nothing saved/]
  C -- no --> D[Rules step: student IDs, card numbers, links, contact format, length, banned words, photos]
  D --> E{Any rule fired?}
  E -- yes --> R[Verdict reject, category of the most serious flag]
  E -- no --> F{Forced-review flag on? test only}
  F -- yes --> H[Verdict review]
  F -- no --> G[Model step: post text and photos only, no username, ID or contacts]
  G --> G1{Answer in time, under the daily cap, valid JSON?}
  G1 -- no --> H
  G1 -- yes --> G2{Model verdict}
  G2 -- approve --> P[Status published]
  G2 -- review --> H
  G2 -- reject --> R
  H --> Q[Status pending_review: author sees Waiting for a moderator]
  R --> S[Status rejected: author sees the category message]
  P --> AU[Audit row: actor automod, model, category, scores, redacted text snapshot]
  Q --> AU
  S --> AU
  AU --> T{Rejected automatically?}
  T -- no --> Z([End])
  T -- yes --> U[Count the rejection for this user]
  U --> V{3rd rejection within the hour?}
  V -- no --> Z
  V -- yes --> W[1-hour posting cooldown, user flagged in the mod panel]
  W --> Z
```

Fail safe: a model error, timeout, malformed answer or the daily cap holds the post for a mod. Unscreened text is never published automatically and never rejected automatically. The rules still apply. Until the real model arrives, the stub step approves text and holds any post with photos.

## Ask a moderator to look

```mermaid
flowchart TD
  A([Author taps Ask a moderator to look on a rejected post]) --> B{Under 5 asks this hour?}
  B -- no --> X1[/Refused: rate limited/]
  B -- yes --> C{Own post, not deleted?}
  C -- no --> X2[/Refused: not found/]
  C -- yes --> D{Status rejected?}
  D -- no --> X3[/Refused: not rejected/]
  D -- yes --> E[Status pending_review, marked as asked]
  E --> F[Post joins the review queue]
  F --> Z([End])
```

Each post type exposes this through its own route (from rides onwards). Editing instead of asking runs the post through the full screening flow again and clears the ask.

## Review queue

```mermaid
flowchart TD
  A([Mod opens Queue]) --> B[Queue size at the top: held posts plus open reports]
  B --> C[Held posts first, then open reports, oldest first within each]
  C --> D{Item}
  D -- held post --> E[Mod reads the text with IDs and card numbers redacted, author username, model category and confidence, rule flags]
  E --> F{Decision}
  F -- approve --> G[Status published]
  F -- reject with a category and reason --> H[Status rejected with that category]
  G --> I{Still held when saved?}
  H --> I
  I -- no --> X[/409 another mod already decided/]
  I -- yes --> J[Audit row with before-snapshot and reason]
  J --> K[Inbox message to the author: approved, or the category message]
  K --> Z([End])
  D -- report --> L[Resolve or dismiss with a note, see moderation-flow.md]
  L --> Z
```

The mod's decision overrides the model. The author never sees the mod's reason, the model's scores or which rule fired, only the category message from [`reject-reasons.md`](reject-reasons.md).

## Probing flag

```mermaid
flowchart TD
  A([Mod opens Users]) --> B[Flagged users show a Flagged badge and any active cooldown]
  B --> C{Honest mistakes?}
  C -- no --> D([Leave the flag, consider a ban])
  C -- yes --> E[Clear flag with a reason]
  E --> F[Flag and cooldown cleared, rejection count reset]
  F --> G[Audit row with snapshot: an admin can reverse it]
  G --> Z([End])
```
