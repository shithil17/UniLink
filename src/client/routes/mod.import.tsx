import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { parseCurriculumText, rejectedRows, type ParsedCurriculum } from "@/lib/courseImport";
import { isToastError, useImportCurriculum } from "@/lib/courses";
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
  const [file, setFile] = useState<{ name: string; parsed: ParsedCurriculum } | null>(null);
  const [result, setResult] = useState<{ imported: number; rejected: Rejected } | null>(null);
  const [failure, setFailure] = useState<{ message: string; rejected: Rejected } | null>(null);

  const pick = async (picked: File | undefined) => {
    setResult(null);
    setFailure(null);
    setFile(
      picked ? { name: picked.name, parsed: parseCurriculumText(await picked.text()) } : null,
    );
  };

  const submit = () => {
    if (!file?.parsed.ok) return;
    setResult(null);
    setFailure(null);
    importCurriculum.mutate(file.parsed.body, {
      onSuccess: (r) => setResult({ imported: r.imported, rejected: r.rejected }),
      onError: (err) => {
        if (isToastError(err)) toast.error(errorMessage(err));
        else setFailure({ message: errorMessage(err), rejected: rejectedRows(err) });
      },
    });
  };

  return (
    <section className="max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Import a curriculum</h1>
        <p className="text-sm text-soft">
          Pick one curriculum JSON file. Importing the same program and version again replaces its
          courses.
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
          {file && !file.parsed.ok ? (
            <FormError message={file.parsed.message} />
          ) : file?.parsed.ok ? (
            <FieldDescription>
              {file.name}: program {file.parsed.body.program}, version {file.parsed.body.version},{" "}
              {file.parsed.rowCount} rows.
            </FieldDescription>
          ) : null}
        </Field>
        <Button
          className="h-11 w-full sm:w-auto"
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
      {failure ? (
        <div className="space-y-3">
          <FormError message={failure.message} />
          <RejectedTable rows={failure.rejected} />
        </div>
      ) : null}
    </section>
  );
}

function RejectedTable({ rows }: { rows: Rejected }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Rejected rows</caption>
        <thead className="border-b border-line text-soft">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Row
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Code
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Reason
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2 text-body">{r.index + 1}</td>
              <td className="px-3 py-2 text-body">{r.code ?? "-"}</td>
              <td className="px-3 py-2 text-body">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
