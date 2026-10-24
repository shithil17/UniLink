import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { CourseCode } from "@/components/courses/CourseCode";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { parseCurriculumText, rejectedRows, type ParsedCurriculum } from "@/lib/courseImport";
import { useImportCurriculum } from "@/lib/courses";
import { modCurriculaQuery } from "@/lib/modCourses";
import { meQuery } from "@/lib/queries";
import type { ImportResult } from "../../shared/schemas/courses";
import { modTitle } from "@/components/mod/modStyles";

type Rejected = ImportResult["rejected"];

export const Route = createFileRoute("/mod/import")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (!user) throw redirect({ to: "/login" });
    if (user.role === "student") throw redirect({ to: "/" });
  },
  component: ImportPage,
});

function ImportPage() {
  const importCurriculum = useImportCurriculum();
  const curricula = useQuery(modCurriculaQuery);
  const [file, setFile] = useState<{ name: string; parsed: ParsedCurriculum } | null>(null);
  const [result, setResult] = useState<{ imported: number; rejected: Rejected } | null>(null);
  const [failure, setFailure] = useState<Rejected | null>(null);

  const pick = async (picked: File | undefined) => {
    setResult(null);
    setFailure(null);
    const next = picked
      ? { name: picked.name, parsed: parseCurriculumText(await picked.text()) }
      : null;
    if (next && !next.parsed.ok) toast.error(next.parsed.message);
    setFile(next);
  };

  // Importing a version that exists swaps all its courses, so edits made on the Courses screen are lost.
  const incoming = file?.parsed.ok ? file.parsed.body : null;
  const replacing =
    incoming !== null &&
    (curricula.data ?? []).some(
      (c) => c.programCode === incoming.program && c.version === incoming.version,
    );

  const submit = () => {
    if (!file?.parsed.ok) return;
    setResult(null);
    setFailure(null);
    importCurriculum.mutate(file.parsed.body, {
      onSuccess: (r) => setResult({ imported: r.imported, rejected: r.rejected }),
      onError: (err) => {
        toast.error(errorMessage(err));
        setFailure(rejectedRows(err));
      },
    });
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className={modTitle}>Import a curriculum</h1>
        <p className="text-[15px] text-soft">
          Pick one curriculum JSON file. Importing a program and version that already exist replaces
          its courses, including changes made in the Courses screen.
        </p>
      </header>
      <FieldGroup>
        <Field data-invalid={file ? !file.parsed.ok : false}>
          <FieldLabel htmlFor="curriculum-file">Curriculum file (.json)</FieldLabel>
          <Input
            id="curriculum-file"
            type="file"
            accept="application/json,.json"
            aria-invalid={file ? !file.parsed.ok : undefined}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          {file?.parsed.ok ? (
            <FieldDescription>
              {file.name}: program {file.parsed.body.program}, version {file.parsed.body.version},{" "}
              {file.parsed.rowCount} rows.
            </FieldDescription>
          ) : null}
          {file && !file.parsed.ok ? (
            <FieldError errors={[{ message: file.parsed.message }]} />
          ) : null}
        </Field>
        {replacing ? (
          <p
            role="note"
            className="flex items-start gap-3 rounded-row bg-danger-soft px-3.5 py-3 text-[15px] text-ink"
          >
            <TriangleAlertIcon
              aria-hidden
              strokeWidth={1.75}
              className="mt-0.5 size-5 shrink-0 text-danger"
            />
            Importing replaces every course of this version, including changes made in the Courses
            screen.
          </p>
        ) : null}
        <Button
          className="w-full sm:w-auto sm:self-start"
          disabled={!file?.parsed.ok || importCurriculum.isPending}
          onClick={submit}
        >
          {importCurriculum.isPending ? "Importing..." : "Import"}
        </Button>
      </FieldGroup>

      {result ? (
        <div className="space-y-3" role="status">
          <p className="text-lg leading-[1.3] font-semibold text-ink tabular-nums">
            Imported {result.imported} {result.imported === 1 ? "course" : "courses"}
            {result.rejected.length > 0 ? `, rejected ${result.rejected.length}` : ""}.
          </p>
          <RejectedTable rows={result.rejected} />
        </div>
      ) : null}
      {failure ? <RejectedTable rows={failure} /> : null}
    </section>
  );
}

/**
 * Rejected rows as a flat panel: hairline rules, no header band, the row number right-aligned. The
 * code wears its course hue (this and the Courses screen are the only mod screens where hue is
 * allowed); a row without a code prints a dash. Rows are 60px on phones.
 */
function RejectedTable({ rows }: { rows: Rejected }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-panel bg-surface md:rounded-[24px]">
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">Rejected rows</caption>
        <thead className="text-[13px] leading-[1.3] font-medium text-soft">
          <tr>
            <th scope="col" className="px-4 pt-3 pb-2 text-right font-medium">
              Row
            </th>
            <th scope="col" className="px-4 pt-3 pb-2 font-medium">
              Code
            </th>
            <th scope="col" className="px-4 pt-3 pb-2 font-medium">
              Reason
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="h-15 border-t border-line align-middle">
              <td className="px-4 py-2.5 text-right font-semibold text-soft tabular-nums">
                {r.index + 1}
              </td>
              <td className="px-4 py-2.5">
                {r.code ? (
                  <CourseCode code={r.code} />
                ) : (
                  <span className="text-faint">&mdash;</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-ink">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
