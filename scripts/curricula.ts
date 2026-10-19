// Reads the transcribed curriculum files in data/curricula/. Node only (the unit test and the seed CLI).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CURRICULA_DIR = join(import.meta.dirname, "..", "data", "curricula");

/** Every `*.json` file in the directory, unparsed, sorted by file name. */
export function readCurriculumFiles(dir: string = CURRICULA_DIR): { file: string; raw: unknown }[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => ({ file, raw: JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown }));
}
