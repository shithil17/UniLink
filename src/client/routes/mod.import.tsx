import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { parseCurriculumText, rejectedRows, type ParsedCurriculum } from "@/lib/courseImport";
import { useImportCurriculum } from "@/lib/courses";
import { modCurriculaQuery } from "@/lib/modCourses";
import { meQuery } from "@/lib/queries";
import type { ImportResult } from "../../shared/schemas/courses";

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
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">Import a curriculum</h1>
        <p className="text-sm text-soft">
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
            className="h-11"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          {file?.parsed.ok ? (
            <FieldDescription>
              {file.name}: program {file.parsed.body.program}, version {file.parsed.body.version},{" "}
              {file.parsed.rowCount} rows.
            </FieldDescription>
          ) : null}
        </Field>
        {replacing ? (
          <p
            role="note"
            className="rounded-control border border-line bg-tint px-3 py-2 text-sm text-body"
          >
            Importing replaces every course of this version, including changes made in the Courses
            screen.
          </p>
        ) : null}
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!file?.parsed.ok || importCurriculum.isPending}
          onClick={submit}
        >
          {importCurriculum.isPending ? "Importing..." : "Import"}
        </Button>
      </FieldGroup>

      {result ? (
        <div className="space-y-3" role="status">
          <p className="font-medium text-ink">
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

function RejectedTable({ rows }: { rows: Rejected }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Rejected rows</caption>
        <thead className="border-b border-line text-soft">
          <tr>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Row
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Code
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Reason
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-b border-line last:border-b-0">
              <td className="px-4 py-2 text-right text-body tabular-nums">{r.index + 1}</td>
              <td className="px-4 py-2 text-body">
                {r.code ?? <span className="text-faint">&mdash;</span>}
              </td>
              <td className="px-4 py-2 text-body">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
