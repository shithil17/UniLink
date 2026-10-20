// Reads the faculty lists in data/faculty/, one file per department (`ece.json`, `mgt.json`, ...). Node only (the seed CLI and the unit test).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { facultySeedEntry, type FacultySeedEntry } from "../src/shared/schemas/faculty.ts";

export const FACULTY_DIR = join(import.meta.dirname, "..", "data", "faculty");

/**
 * Every `*.json` file in the directory in file-name order, each row checked against the shared schema.
 * A row whose department is not the one in its file name is an error, so a person cannot hide in the wrong list.
 */
export function readFacultyFiles(dir: string = FACULTY_DIR): FacultySeedEntry[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown;
      const parsed = z.array(facultySeedEntry).safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`${file}: ${issue?.path.join(".")} ${issue?.message}`);
      }
      const code = file.slice(0, -".json".length).toUpperCase();
      for (const row of parsed.data) {
        if (row.department !== code) {
          throw new Error(`${file}: "${row.name}" is in ${row.department}, not ${code}`);
        }
      }
      return parsed.data;
    });
}
