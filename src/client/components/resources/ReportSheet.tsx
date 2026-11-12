import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useReport } from "@/lib/resources";
import { toast } from "@/lib/toast";
import { reasonBody } from "../../../shared/schemas/moderation";

export type ReportTarget = { type: "resource_request" | "resource_submission"; id: number };

/**
 * Tells the moderators about a request or a link. The reason uses the shared reason rules, and the
 * moderators see the report in their queue. Sending shows a toast and closes the sheet.
 */
export function ReportSheet({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const report = useReport();
  const form = useForm({ resolver: zodResolver(reasonBody), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const close = () => {
    form.reset();
    onClose();
  };
  const submit = form.handleSubmit(({ reason }) => {
    if (!target) return;
    report.mutate(
      { targetType: target.type, targetId: target.id, reason },
      {
        onSuccess: () => {
          toast.success("Report sent. A moderator will take a look.");
          close();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  });

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>
            {target?.type === "resource_submission" ? "Report this link" : "Report this request"}
          </SheetTitle>
          <SheetDescription>
            Say what is wrong, such as a link that isn't what it claims or a request that breaks the
            rules. Moderators read every report.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="px-5 pb-1">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.reason)}>
              <FieldLabel htmlFor="report-reason">What is wrong</FieldLabel>
              <Textarea
                id="report-reason"
                aria-invalid={Boolean(errors.reason)}
                {...form.register("reason")}
              />
              <FieldError errors={[errors.reason]} />
            </Field>
            <div className="flex flex-col gap-2">
              <Button type="submit" loading={report.isPending}>
                Send report
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
            </div>
          </FieldGroup>
        </form>
      </SheetContent>
    </Sheet>
  );
}
