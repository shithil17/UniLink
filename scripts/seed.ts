// Fixture data for local dev and API tests: the curricula in data/curricula/, the faculty list in data/faculty.json and two fake students.
// Run against local D1 with `vp run seed` (after `vp run db:migrate:local`); safe to run again.
// API tests call `seed(env.DB)`, optionally with curricula they loaded themselves (a worker cannot read files).
//
// Fake students, both with the password below (never use it outside local dev):
//   dev_cse   CSE, admitted 22, student ID 221-9001-0-42
//   dev_bba   BBA, admitted 23, student ID 231-9002-0-30
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkImportRows,
  toCurriculumHeader,
  toNewCourse,
} from "../src/server/features/courses/importRows.ts";
import { hashPassword } from "../src/server/password.ts";
import { facultySeedEntry } from "../src/shared/schemas/faculty.ts";
import { curriculumImport, type CurriculumImport } from "../src/shared/schemas/courses.ts";
import { z } from "zod";
import { readCurriculumFiles } from "./curricula.ts";

/** The faculty list `vp run seed` reads. */
const FACULTY_FILE = join(import.meta.dirname, "..", "data", "faculty.json");

export const DEV_PASSWORD = "unilink-dev-2026";

// Serials start at 9001 so they never clash with the keys test factories hand out.
const DEV_STUDENTS = [
  { username: "dev_cse", key: "2219001", suffix: "042", year: 22, name: "Dev CSE Student" },
  { username: "dev_bba", key: "2319002", suffix: "030", year: 23, name: "Dev BBA Student" },
] as const;

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlNullable = (value: unknown) => (value == null ? "NULL" : sqlString(JSON.stringify(value)));

/** Insert-or-update of the curriculum, then its courses replaced one row per statement. */
function curriculumStatements(file: CurriculumImport, now: number): string[] {
  const header = toCurriculumHeader(file);
  const { accepted, rejected } = checkImportRows(file.courses);
  if (rejected.length > 0) {
    throw new Error(`${header.programCode} ${header.version}: ${JSON.stringify(rejected)}`);
  }
  const which = `program_code = ${sqlString(header.programCode)} AND version = ${sqlString(header.version)}`;
  const id = `(SELECT id FROM curricula WHERE ${which})`;
  return [
    `INSERT INTO curricula (program_code, name, version, effective_from_year, total_credits, created_at) VALUES (${sqlString(header.programCode)}, ${sqlString(header.name)}, ${sqlString(header.version)}, ${header.effectiveFromYear}, ${header.totalCredits}, ${now}) ON CONFLICT (program_code, version) DO UPDATE SET name = excluded.name, effective_from_year = excluded.effective_from_year, total_credits = excluded.total_credits;`,
    `DELETE FROM courses WHERE curriculum_id = ${id};`,
    ...accepted
      .map(toNewCourse)
      .map(
        (c) =>
          `INSERT INTO courses (curriculum_id, position, kind, code, title, credits, category, non_credit, semester, alternatives, prereq) VALUES (${id}, ${c.position}, ${sqlString(c.kind)}, ${sqlString(c.code)}, ${sqlString(c.title)}, ${c.credits}, ${sqlString(c.category)}, ${c.nonCredit ? 1 : 0}, ${c.semester ?? "NULL"}, ${sqlString(JSON.stringify(c.alternatives))}, ${sqlNullable(c.prereq)});`,
      ),
  ];
}

/** Insert-or-update by name, so running the seed again (or with an edited list) never duplicates a row. */
function facultyStatements(raw: readonly unknown[]): string[] {
  return z
    .array(facultySeedEntry)
    .parse(raw)
    .map(
      (f) =>
        `INSERT INTO faculty (name, initials, designation) VALUES (${sqlString(f.name)}, ${sqlString(f.initials)}, ${sqlString(f.designation)}) ON CONFLICT (name) DO UPDATE SET initials = excluded.initials, designation = excluded.designation;`,
    );
}

export async function seedStatements(
  curricula: readonly unknown[] = [],
  now: number = Date.now(),
  faculty: readonly unknown[] = [],
): Promise<string[]> {
  const password = await hashPassword(DEV_PASSWORD);
  return [
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded', ${sqlString("dev")});`,
    ...curricula.flatMap((raw) => curriculumStatements(curriculumImport.parse(raw), now)),
    ...facultyStatements(faculty),
    // OR IGNORE: running the seed again leaves the students (and anything they recorded) alone.
    ...DEV_STUDENTS.map(
      (s) =>
        `INSERT OR IGNORE INTO users (username, student_key, student_suffix, admission_year, password_hash, password_salt, password_algo, password_iterations, role, must_change_password, full_name, email, created_at) VALUES (${sqlString(s.username)}, ${sqlString(s.key)}, ${sqlString(s.suffix)}, ${s.year}, ${sqlString(password.hash)}, ${sqlString(password.salt)}, ${sqlString(password.algo)}, ${password.iterations}, 'student', 0, ${sqlString(s.name)}, ${sqlString(`${s.username}@northsouth.edu`)}, ${now});`,
    ),
  ];
}

export async function seed(
  db: D1Database,
  curricula: readonly unknown[] = [],
  faculty: readonly unknown[] = [],
): Promise<void> {
  const statements = await seedStatements(curricula, Date.now(), faculty);
  await db.batch(statements.map((sql) => db.prepare(sql)));
}

if (import.meta.main) {
  const dir = mkdtempSync(join(tmpdir(), "unilink-seed-"));
  try {
    const file = join(dir, "seed.sql");
    const curricula = readCurriculumFiles().map(({ raw }) => raw);
    const faculty = JSON.parse(readFileSync(FACULTY_FILE, "utf8")) as unknown[];
    writeFileSync(file, (await seedStatements(curricula, Date.now(), faculty)).join("\n"));
    execFileSync("wrangler", ["d1", "execute", "DB", "--local", `--file=${file}`], {
      stdio: "inherit",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
