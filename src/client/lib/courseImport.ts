import { z } from "zod";
import { ApiError } from "./api";
import { curriculumImportEnvelope, importRejection } from "../../shared/schemas/courses";

type Envelope = z.infer<typeof curriculumImportEnvelope>;

export type ParsedCurriculum =
  | { ok: true; body: Envelope; rowCount: number }
  | { ok: false; message: string };

/** Parse a picked file's text. The header is checked here; rows are left for the server to check one by one. */
export function parseCurriculumText(text: string): ParsedCurriculum {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: "That file is not valid JSON." };
  }
  const parsed = curriculumImportEnvelope.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return { ok: false, message: `This is not a curriculum file (${where}${issue.message}).` };
  }
  return { ok: true, body: parsed.data, rowCount: parsed.data.courses.length };
}

const rejectedBody = z.object({ rejected: z.array(importRejection) });

/** The rejected rows a failed import (422) carries, or an empty list for any other error. */
export function rejectedRows(err: unknown): z.infer<typeof importRejection>[] {
  if (!(err instanceof ApiError)) return [];
  const parsed = rejectedBody.safeParse(err.body);
  return parsed.success ? parsed.data.rejected : [];
}
