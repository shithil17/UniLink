import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { useConfirm } from "@/lib/useConfirm";
import { ReasonForm } from "@/components/mod/ReasonForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { modPanel as panel, modRowMin, modTitle } from "@/components/mod/modStyles";
import { errorMessage } from "@/lib/api";
import { idHolderLookup, useReleaseKey } from "@/lib/mod";
import { releaseKeyConfirm } from "@/lib/modConfirm";
import { meQuery } from "@/lib/queries";
import { canActOn } from "../../shared/modPolicy";
import { idConflictQuery, STUDENT_KEY_LENGTH } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/id-conflict")({
  component: IdConflictPage,
});

const detailRow = `flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[15px] ${modRowMin}`;

function IdConflictPage() {
  const [key, setKey] = useState<string | null>(null);
  const form = useForm<z.input<typeof idConflictQuery>, unknown, z.output<typeof idConflictQuery>>({
    resolver: zodResolver(idConflictQuery),
    defaultValues: { key: "" },
  });
  const { errors } = form.formState;

  return (
    <section className="space-y-4">
      <h1 className={modTitle}>ID check</h1>
      <p className="text-soft">
        Someone says their student ID is already registered? Look up who holds it. This is the only
        screen that shows a student ID, and each lookup is logged.
      </p>
      <form onSubmit={form.handleSubmit((values) => setKey(values.key))} noValidate>
        <div className="flex items-start gap-2">
          <Field data-invalid={Boolean(errors.key)} className="flex-1">
            <FieldLabel htmlFor="id-key" className="sr-only">
              First {STUDENT_KEY_LENGTH} digits of the student ID
            </FieldLabel>
            <Input
              id="id-key"
              className="tabular-nums"
              inputMode="numeric"
              autoComplete="off"
              maxLength={STUDENT_KEY_LENGTH}
              placeholder={`First ${STUDENT_KEY_LENGTH} digits`}
              aria-invalid={Boolean(errors.key)}
              {...form.register("key")}
            />
            <FieldError errors={[errors.key]} />
          </Field>
          <Button type="submit" size="lg">
            Look up
          </Button>
        </div>
      </form>
      {key ? <Holder key={key} studentKey={key} /> : null}
    </section>
  );
}

function Holder({ studentKey }: { studentKey: string }) {
  const lookup = useQuery(idHolderLookup(studentKey));
  const { data: me } = useQuery(meQuery);
  const release = useReleaseKey();
  const confirm = useConfirm();

  if (lookup.isPending) {
    return (
      <div role="status" aria-busy="true" className={`${panel} grid gap-3 p-4`}>
        <span className="sr-only">Looking up</span>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    );
  }
  if (lookup.isError) {
    return (
      <ErrorBlock
        title="The lookup failed"
        message={errorMessage(lookup.error)}
        onRetry={() => void lookup.refetch()}
        retrying={lookup.isRefetching}
      />
    );
  }
  const holder = lookup.data.holder;
  if (!holder) {
    return (
      <div className={panel}>
        <EmptyState
          icon={SearchIcon}
          title="No account holds that ID"
          description="It is free to register, or was already released."
        />
      </div>
    );
  }

  // The signed-in id is not exposed, so the username tells whether the holder is the viewer.
  const can = me
    ? canActOn({ id: me.username === holder.username ? holder.id : 0, role: me.role }, holder)
    : false;

  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
        <p className="text-lg leading-[1.3] font-semibold text-ink">{holder.username}</p>
        {holder.role !== "student" ? (
          <Badge>{holder.role === "admin" ? "Admin" : "Mod"}</Badge>
        ) : null}
        {holder.bannedAt !== null ? <Badge>Banned</Badge> : null}
      </div>
      <dl>
        <div className={detailRow}>
          <dt className="text-soft">Student ID</dt>
          <dd className="font-medium text-ink tabular-nums">{holder.studentId}</dd>
        </div>
        <div className={detailRow}>
          <dt className="text-soft">Joined</dt>
          <dd className="text-ink tabular-nums">
            {new Date(holder.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}
          </dd>
        </div>
      </dl>
      <div className="space-y-4 border-t border-line p-4">
        {can ? (
          <>
            <p className="text-soft">
              Releasing bans this account and frees the ID, so its real owner can sign up. An admin
              can reverse it.
            </p>
            <ReasonForm
              id="release-reason"
              submitLabel="Release ID and ban"
              variant="destructive"
              hint="Say why this account should not hold the ID."
              onSubmit={(reason) =>
                confirm.ask({
                  ...releaseKeyConfirm(holder, reason),
                  run: async () => {
                    await release.mutateAsync({ userId: holder.id, reason });
                    toast.success("ID released");
                    void lookup.refetch();
                  },
                })
              }
            />
          </>
        ) : (
          <FieldDescription>
            {holder.role === "student"
              ? "You can't act on this account."
              : "Only an admin can act on a mod, and no one can act on an admin here."}
          </FieldDescription>
        )}
      </div>
      {confirm.element}
    </div>
  );
}
