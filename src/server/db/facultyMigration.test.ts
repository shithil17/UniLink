import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vite-plus/test";

const DIR = join(import.meta.dirname, "..", "..", "..", "drizzle");
const FACULTY_MIGRATION = "0010_faculty_directory.sql";

/** Runs the migration files before (or including) `upTo`, statement by statement, the way D1 does. */
function migrate(db: DatabaseSync, files: string[]) {
  for (const file of files) {
    for (const statement of readFileSync(join(DIR, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      db.exec(statement);
    }
  }
}

describe("faculty directory migration", () => {
  it("keeps faculty ids and the attempts that point at them", () => {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db, files.slice(0, files.indexOf(FACULTY_MIGRATION)));

    db.exec(
      "INSERT INTO faculty (name, initials, designation) VALUES ('Has Initials', 'HiN', 'Professor'), ('No Initials', '', 'Lecturer')",
    );
    db.exec(
      "INSERT INTO users (username, student_key, student_suffix, admission_year, password_hash, password_salt, password_algo, password_iterations, role, must_change_password, created_at) VALUES ('u', '2219999', '042', 22, 'h', 's', 'pbkdf2', 1, 'student', 0, 0)",
    );
    db.exec(
      "INSERT INTO attempts (user_id, course_code, grade, faculty_id, created_at) VALUES (1, 'CSE115', 'A', 1, 0), (1, 'CSE173', 'B', 2, 0)",
    );

    migrate(db, [FACULTY_MIGRATION]);

    expect(db.prepare("SELECT faculty_id FROM attempts ORDER BY id").all()).toEqual([
      { faculty_id: 1 },
      { faculty_id: 2 },
    ]);
    expect(
      db
        .prepare("SELECT id, name, initials, department, nsu_page, hidden FROM faculty ORDER BY id")
        .all(),
    ).toEqual([
      {
        id: 1,
        name: "Has Initials",
        initials: "HiN",
        department: "ECE",
        nsu_page: null,
        hidden: 0,
      },
      { id: 2, name: "No Initials", initials: null, department: "ECE", nsu_page: null, hidden: 0 },
    ]);
  });

  it("makes initials unique without case, and lets rows go without them", () => {
    const db = new DatabaseSync(":memory:");
    migrate(
      db,
      readdirSync(DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort(),
    );
    const add = (name: string, initials: string | null, department = "ECE") =>
      db
        .prepare(
          "INSERT INTO faculty (name, initials, designation, department) VALUES (?, ?, 'x', ?)",
        )
        .run(name, initials, department);
    add("A", "SfR1");
    expect(() => add("B", "sfr1")).toThrow(/UNIQUE/);
    add("C", null);
    add("D", null);
    expect(() => add("A", "Zz", "ECE")).toThrow(/UNIQUE/);
    add("A", "Zz", "LAW");
  });
});
