# Data formats for D

What D hands over for the course maps and the faculty list. The shapes the app accepts are in `src/shared/schemas/courses.ts` (`curriculumImport`) and `src/server/db/schema.ts`.

## Curriculum

Delivered as one JSON file per program and version, in `data/curricula/<program code>-<short name>.json` (for example `42-cse.json`). Re-importing the same program and version replaces its courses.

### File fields

| Field               | Type     | Notes                                                                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `program`           | string   | Last two digits of the student ID, a key of the NSU program list (`42` = CSE)                                                    |
| `name`              | string   | Program name                                                                                                                     |
| `version`           | string   | Label such as `Fall 2014`                                                                                                        |
| `effectiveFromYear` | number   | Admission year (YY) the version applies from. A student gets the highest version not after their admission year, else the oldest |
| `totalCredits`      | number   | Degree total (earned credits may exceed it)                                                                                      |
| `source`            | string   | Name of the official map the data came from                                                                                      |
| `notes`             | string[] | Anything inferred or not encoded (category guesses, prerequisites that could not be written as a rule)                           |
| `courses`           | array    | Rows below, in map order. Order decides which slot a passing attempt fills first                                                 |

### Course row (spreadsheet columns)

If D works in a spreadsheet, use these columns and convert to JSON.

| Column        | JSON key       | Notes                                                                                          |
| ------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| Kind          | `kind`         | `course` for a fixed course, `elective` for a placeholder (ELECT1, OPEN ELECT, major slot)     |
| Code          | `code`         | Unique within the file                                                                         |
| Title         | `title`        |                                                                                                |
| Credits       | `credits`      | Number; 1.5 is allowed; 0 for non-credit                                                       |
| Category      | `category`     | Exactly the same text for every course in a category (for example `Major Core`)                |
| Non-credit    | `nonCredit`    | `true` or `false`; excluded from CGPA                                                          |
| Semester      | `semester`     | Suggested semester number, optional                                                            |
| Alternatives  | `alternatives` | Other codes filling the same slot: `[{ "code": "POL104", "title": "…" }]`; empty for electives |
| Prerequisites | `prereq`       | Rule tree, or `null`                                                                           |

### Prerequisite rule

A rule is one of:

- a course: `{ "course": "MAT116" }`
- all of: `{ "all": [rule, rule] }`
- any of: `{ "any": [rule, rule] }`
- earned credits: `{ "credits": 100 }` (for "100 credits completed")

A waiver ("ENG102/Waiver") is written as the plain course. Every course in a rule must be a code in the same file; the data test fails otherwise.

### Checking a file

Run `vp test courses`. It validates every file in `data/curricula/` against the schema and checks the prerequisite codes. Then check the content against the official map:

1. Total credits equal `totalCredits`.
2. Every course on the map is present, with the right credits and category.
3. Spot-check ten prerequisites.
4. Each notes entry describes anything not encoded.

Programs with data: Architecture (10), LLB (11), MCJ (12), Public Health (18), Economics (20), CEE (25), Environmental Management (27), BBA (30), CSE (42), EEE (43), Pharmacy (46), Biochemistry and Biotechnology (47), Microbiology (48). Still missing: ETE, English, Anthropology, Sociology, History, Environmental Science.

## Faculty list

Seeded from `data/faculty.json` (currently six placeholder rows). The attempt picker needs the first three columns. Phase 11 (faculty profiles) needs the rest, so collect them now.

| Column             | In `faculty.json` today | Notes                                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------------------------- |
| Name               | `name`                  | Unique; the seed upserts on name                                       |
| Initials           | `initials`              | The short form students use, such as three letters                     |
| Designation        | `designation`           | Professor, Associate Professor, Assistant Professor, Lecturer          |
| NSU page URL       | later                   | Public faculty page                                                    |
| Google Scholar URL | later                   | Optional                                                               |
| ORCID              | later                   | Optional                                                               |
| OpenAlex author ID | later                   | Checked by hand against the person's papers, not guessed from the name |

Only public information. Do not collect phone numbers, personal emails or anything not already on a public page.

Example of the current file shape:

```json
[{ "name": "Full Name", "initials": "FN", "designation": "Assistant Professor" }]
```
