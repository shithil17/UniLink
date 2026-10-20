# Class diagram (Phases 0 to 7)

Domain model from `src/server/db/schema.ts`, plus the shared strategy objects and helpers. Times are UTC epoch ms. "Private" fields never appear in a response to anyone but the owner.

## Data model

```mermaid
classDiagram
  class User {
    +int id
    +string username
    +string studentKey  «private, unique»
    +string studentSuffix  «private»
    +int admissionYear
    +Role role
    +int bannedAt?
    +bool mustChangePassword
    +string fullName?  «private»
    +string email?  «private, unique»
    +int createdAt
  }
  class Session {
    +int id
    +string tokenHash
    +int expiresAt
  }
  class Curriculum {
    +int id
    +string programCode
    +string name
    +string version
    +int effectiveFromYear
    +real totalCredits
  }
  class Course {
    +int id
    +int position
    +Kind kind  «course | elective»
    +string code
    +string title
    +real credits
    +string category
    +bool nonCredit
    +int semester?
    +Alternative[] alternatives
    +PrereqRule prereq?
  }
  class StudentCourse {
    +int id
    +string code
    +string title
    +real credits
    +string category
    +bool excluded
  }
  class Attempt {
    +int id
    +string courseCode
    +string grade
    +int termYear?
    +Season termSeason?
  }
  class Faculty {
    +int id
    +string name
    +string initials
    +string designation
  }
  class Notification {
    +int id
    +string type
    +json payload
    +int readAt?
  }
  class PushSubscription {
    +int id
    +string endpoint  «unique»
    +string p256dh
    +string auth
  }
  class Report {
    +int id
    +string targetType
    +string targetId
    +string reason
    +ReportStatus status  «open | resolved | dismissed»
    +int resolvedAt?
    +string resolveNote?
  }
  class AuditLog {
    +int id
    +string actor  «user id, automod or system»
    +string action
    +string targetType
    +string targetId
    +json before  «snapshot»
    +string reason?
    +int reversesId?  «unique»
  }
  class RateLimit {
    +string key
    +int windowStart
    +int count
  }

  User "1" --> "*" Session
  User "1" --> "*" Attempt : owns
  User "1" --> "*" StudentCourse : owns
  User "1" --> "*" Notification : receives
  User "1" --> "*" PushSubscription : devices
  User "1" --> "*" Report : files
  User "1" --> "0..*" Report : resolves
  Curriculum "1" *-- "*" Course
  Faculty "0..1" <-- "*" Attempt : taught by
  AuditLog "0..1" <-- "0..1" AuditLog : reverses
  Attempt ..> Course : courseCode
  Attempt ..> StudentCourse : courseCode
  User ..> Curriculum : program + admission year
```

An attempt refers to a course by code, not by key: the code is a curriculum slot, one of its alternatives, or one of the user's student courses. A report's target is a `(targetType, targetId)` pair so a new post type needs no migration.

## Behaviour: strategies and helpers

```mermaid
classDiagram
  class GradeScale {
    <<interface>>
    +name
    +points
  }
  class NSU_SCALE
  class RetakePolicy {
    <<interface>>
    +canRetake(attempts) bool
  }
  class BELOW_B_PLUS_POLICY
  class Grading {
    +gradePoints(grade, scale)
    +bestAttempt(attempts)
    +cgpa(attempts, courses)
    +earnedCredits(attempts, courses)
    +canRetake(attempts, policy)
  }
  class PrereqRule {
    <<composite>>
  }
  class CourseLeaf
  class CreditsLeaf
  class AllGroup
  class AnyGroup
  class PushSender {
    <<interface>>
    +send(subscription, message)
  }
  class WebPushSender
  class FakePushSender
  class Notify {
    +notify(db, userIds, type, payload, opts)
  }
  class Audit {
    +audit(db, entry)
  }
  class Reverse {
    +reverse(auditId, adminId, reason)
  }
  class ModPolicy {
    +canActOn(actor, target)
  }

  GradeScale <|.. NSU_SCALE
  RetakePolicy <|.. BELOW_B_PLUS_POLICY
  Grading ..> GradeScale
  Grading ..> RetakePolicy
  PrereqRule <|-- CourseLeaf
  PrereqRule <|-- CreditsLeaf
  PrereqRule <|-- AllGroup
  PrereqRule <|-- AnyGroup
  AllGroup o-- PrereqRule
  AnyGroup o-- PrereqRule
  PushSender <|.. WebPushSender
  PushSender <|.. FakePushSender
  Notify ..> PushSender : best effort
  Reverse ..> Audit : writes reversal row
```

Patterns in use: Strategy (grade scale, retake policy), Composite (prerequisite rules), Observer entry point (`notify`), adapter plus fake (push sender). Class names above are conceptual where the code uses plain objects and functions.
