# Moderation flow (activity diagrams)

Covers Phase 7. Held posts from content screening share the queue with reports; see [`screening-flow.md`](screening-flow.md). Every box that changes state writes an audit row.

## Report to resolution

```mermaid
flowchart TD
  A([Student taps Report]) --> B{Own target?}
  B -- yes --> X1[/400 refused/]
  B -- no --> C{Under 10 reports this hour?}
  C -- no --> X2[/429 rate limited/]
  C -- yes --> D{Target exists?}
  D -- no --> X3[/404/]
  D -- yes --> E{Open report from this user on this target?}
  E -- yes --> X4[/409 already_reported/]
  E -- no --> F[Store report: status open]
  F --> G[Report waits in the queue, oldest first]
  G --> H[Mod opens the report]
  H --> I{Decision}
  I -- act on the content or user --> J[Soft delete, ban or other action with reason]
  J --> K[Audit row with before-snapshot]
  K --> L[Resolve with note: status resolved]
  I -- no action needed --> M[Dismiss with note: status dismissed]
  L --> N[Audit row]
  M --> N
  N --> Z([End])
```

## Acting on a user

```mermaid
flowchart TD
  A([Mod picks an action on a user]) --> B{Target is the actor or an admin?}
  B -- yes --> X[/403 forbidden_target/]
  B -- no --> C{Actor is mod and target is a mod?}
  C -- yes --> X
  C -- no --> D{Action}
  D -- ban --> E{Already banned?}
  E -- yes --> Y[/409/]
  E -- no --> F[Set banned_at, delete sessions]
  D -- unban --> G{Banned?}
  G -- no --> Y
  G -- yes --> H[Clear banned_at]
  D -- reset password --> I[Generate temporary password, set must_change_password, delete sessions]
  I --> J[Show password once, no-store]
  F --> K[Audit row: snapshot and reason]
  H --> K
  J --> K
  K --> Z([End])
```

## ID conflict

```mermaid
flowchart TD
  A([Student cannot sign up: ID already registered]) --> B[Student contacts a mod]
  B --> C[Mod looks up the 7-digit key]
  C --> D[Audit row id_lookup]
  D --> E{Holder found?}
  E -- no --> F([Student signs up normally])
  E -- yes --> G[Mod sees holder handle, state and student ID]
  G --> H{Real owner of the ID?}
  H -- holder is --> I([Nothing to do])
  H -- holder is not --> J[Release with reason]
  J --> K[Holder banned, key replaced by released:id]
  K --> L[Audit row with snapshot]
  L --> F
```

## Admin reversal

```mermaid
flowchart TD
  A([Admin opens audit log]) --> B[Choose a row]
  B --> C{Reversible type? ban, unban, role change, key release, soft delete}
  C -- no --> X1[/409 not_reversible or is_reversal/]
  C -- yes --> D{Already reversed?}
  D -- yes --> X2[/409 already_reversed/]
  D -- no --> E{Key release and key taken since?}
  E -- yes --> X3[/409 key_in_use/]
  E -- no --> F{Target is an admin now?}
  F -- yes --> X4[/403 target_protected/]
  F -- no --> G[Restore the snapshot]
  G --> H[Audit row linked by reverses_id]
  H --> Z([End])
```
