// Turns data/faculty/ into the same upsert SQL `vp run seed` uses, so staging and production can be seeded:
//   vp run faculty:sql /tmp/faculty.sql
//   vp exec wrangler d1 execute DB --env staging --remote --file=/tmp/faculty.sql
// With no path the SQL goes to stdout. Safe to run again: rows are matched on name and department.
import { writeFileSync } from "node:fs";
import { readFacultyFiles } from "./faculty.ts";
import { facultyStatements } from "./seed.ts";

if (import.meta.main) {
  const sql = facultyStatements(readFacultyFiles()).join("\n");
  const [out] = process.argv.slice(2);
  if (out) writeFileSync(out, `${sql}\n`);
  else process.stdout.write(`${sql}\n`);
}
