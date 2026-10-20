import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { ReasonForm } from "@/components/mod/ReasonForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { idHolderLookup, useReleaseKey } from "@/lib/mod";
import { meQuery } from "@/lib/queries";
import { canActOn } from "../../shared/modPolicy";
import { idConflictQuery, STUDENT_KEY_LENGTH } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/id-conflict")({
  component: IdConflictPage,
});

const panel = "rounded-panel border border-line bg-surface";

function IdConflictPage() {
  const [key, setKey] = useState<string | null>(null);
  const form = useForm<z.input<typeof idConflictQuery>, unknown, z.output<typeof idConflictQuery>>({
    resolver: zodResolver(idConflictQuery),
    defaultValues: { key: "" },
  });
  const { errors } = form.formState;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">ID check</h1>
      <p className="text-sm text-soft">
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
              className="h-11 tabular-nums"
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

  if (lookup.isPending) {
    return <div className={`${panel} h-24`} aria-busy="true" aria-label="Looking up" />;
  }
  if (lookup.isError) {
    return (
      <div className={`${panel} p-6 text-center`}>
        <p className="font-medium text-ink">The lookup failed</p>
        <p className="mt-1 text-sm text-soft">{errorMessage(lookup.error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => void lookup.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const holder = lookup.data.holder;
  if (!holder) {
    return (
      <div className={`${panel} p-6 text-center`}>
        <p className="text-sm text-soft">
          No account holds that ID, so it is free to register (or was already released).
        </p>
      </div>
    );
  }

  // The signed-in id is not exposed, so the username tells whether the holder is the viewer.
  const can = me
    ? canActOn({ id: me.username === holder.username ? holder.id : 0, role: me.role }, holder)
    : false;

  return (
    <div className={`${panel} space-y-4 p-4`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{holder.username}</p>
          {holder.role !== "student" ? (
            <Badge>{holder.role === "admin" ? "Admin" : "Mod"}</Badge>
          ) : null}
          {holder.bannedAt !== null ? <Badge>Banned</Badge> : null}
        </div>
        <p className="text-sm text-soft">
          Student ID <span className="text-ink tabular-nums">{holder.studentId}</span>
        </p>
        <p className="text-sm text-faint">
          Joined{" "}
          <span className="tabular-nums">
            {new Date(holder.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}
          </span>
        </p>
      </div>
      {can ? (
        <>
          <p className="text-sm text-soft">
            Releasing bans this account and frees the ID, so its real owner can sign up. An admin
            can reverse it.
          </p>
          <ReasonForm
            id="release-reason"
            submitLabel="Release ID and ban"
            pendingLabel="Releasing"
            variant="destructive"
            pending={release.isPending}
            hint="Say why this account should not hold the ID."
            onSubmit={(reason) => {
              release.mutate(
                { userId: holder.id, reason },
                {
                  onSuccess: () => {
                    toast.success("ID released");
                    void lookup.refetch();
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              );
            }}
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
  );
}
