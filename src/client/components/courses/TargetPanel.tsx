import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { formatCgpa } from "@/lib/attempts";
import { useSaveTarget } from "@/lib/courses";
import { targetCgpaQuery } from "@/lib/queries";
import { targetReached } from "@/lib/plannerModel";
import { toast } from "@/lib/toast";
import { targetCgpaInput, type TargetCgpaInput } from "../../../shared/schemas/attempts";

function Figure({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-[1.3] font-medium text-soft">{label}</dt>
      <dd
        className="mt-1 text-4xl leading-none font-semibold text-ink tabular-nums"
        aria-label={value === null ? `No ${label.toLowerCase()} CGPA yet` : undefined}
      >
        {formatCgpa(value)}
      </dd>
      {note ? <dd className="mt-1.5 text-xs leading-[1.3] text-faint">{note}</dd> : null}
    </div>
  );
}

function TargetForm({ saved, reached }: { saved: number | null; reached: boolean }) {
  const save = useSaveTarget();
  const form = useForm<TargetCgpaInput>({
    resolver: zodResolver(targetCgpaInput) as Resolver<TargetCgpaInput>,
    defaultValues: { targetCgpa: saved ?? undefined },
  });
  const { errors } = form.formState;
  const help = reached
    ? "Set a higher target to keep going."
    : saved === null
      ? "From 0.01 to 4.00, above your CGPA."
      : null;

  const submit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (response) => {
        toast.success("Target saved");
        form.reset({ targetCgpa: response.targetCgpa ?? undefined });
      },
      onError: (err) => {
        // A target at or below the real CGPA is a mistake in this field; anything else is a toast.
        if (err instanceof ApiError && err.code === "target_not_above_current") {
          form.setError("targetCgpa", { type: "server", message: errorMessage(err) });
          return;
        }
        toast.error(errorMessage(err));
      },
    }),
  );

  return (
    <form onSubmit={submit} noValidate>
      <Field data-invalid={Boolean(errors.targetCgpa)}>
        <FieldLabel htmlFor="planner-target">Target CGPA</FieldLabel>
        <div className="flex items-start gap-2">
          <Input
            id="planner-target"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="3.50"
            aria-invalid={Boolean(errors.targetCgpa)}
            aria-describedby={help ? "planner-target-help" : undefined}
            className="tabular-nums"
            {...form.register("targetCgpa", { valueAsNumber: true })}
          />
          <Button type="submit" className="shrink-0" loading={save.isPending}>
            Save target
          </Button>
        </div>
        <FieldError errors={[errors.targetCgpa]} />
        {help ? <FieldDescription id="planner-target-help">{help}</FieldDescription> : null}
      </Field>
    </form>
  );
}

/**
 * Current and projected CGPA side by side, and the target field. The current CGPA comes from the
 * real attempts, the projected one adds the mock grades.
 */
export function TargetPanel({
  current,
  projected,
  mockCount,
}: {
  current: number | null;
  projected: number | null;
  mockCount: number;
}) {
  const target = useQuery(targetCgpaQuery);
  const saved = target.data?.targetCgpa ?? null;
  const reached = targetReached(current, saved);
  return (
    <section aria-labelledby="planner-target-title" className="grid gap-4">
      <div className="rounded-panel bg-surface p-5 md:rounded-[24px]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="planner-target-title" className="text-base font-semibold text-ink">
            Your CGPA
          </h2>
          {reached ? <Badge variant="soft">Target reached</Badge> : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <Figure
            label="Current"
            value={current}
            note={current === null ? "No grades yet" : undefined}
          />
          <Figure
            label="Projected"
            value={projected}
            note={
              mockCount === 0
                ? undefined
                : `With ${mockCount} mock ${mockCount === 1 ? "grade" : "grades"}`
            }
          />
        </dl>
        <div className="mt-4 border-t border-line pt-4">
          {target.isPending ? (
            <div aria-busy="true" className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12" />
            </div>
          ) : target.isError ? (
            <div className="grid justify-items-start gap-2">
              <p role="alert" className="text-sm text-soft">
                Your target did not load.
              </p>
              <Button variant="outline" size="sm" onClick={() => void target.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <TargetForm key={saved ?? "none"} saved={saved} reached={reached} />
          )}
        </div>
      </div>
    </section>
  );
}
