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
import { toastFirstFieldError } from "@/lib/formErrors";
import { useReport, type PostTargetType } from "@/lib/posts";
import { toast } from "@/lib/toast";
import { reasonBody } from "../../../shared/schemas/moderation";

export type ReportTarget = { type: PostTargetType; id: number };

const DEFAULT_DESCRIPTION =
  "Say what is wrong, such as something that breaks the rules or isn't what it claims. Moderators read every report.";

/**
 * Tells the moderators about a post of any type. The reason uses the shared reason rules, and the
 * moderators see the report in their queue. Sending shows a toast and closes the sheet. `title` names
 * what is being reported ("Report this ride"); `description` can say what counts for that type.
 */
export function ReportSheet({
  target,
  title,
  description = DEFAULT_DESCRIPTION,
  onClose,
}: {
  target: ReportTarget | null;
  title: string;
  description?: string;
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
  }, toastFirstFieldError);

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
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
