import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRemoveReported } from "@/lib/mod";
import { removableName, removeReportedConfirm } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/lib/useConfirm";
import { removalBody, type ModReport } from "../../../shared/schemas/moderation";
import { ReasonForm } from "./ReasonForm";

/**
 * The Remove form for a reported request or link: a reason for the audit log, then the confirm sheet.
 * Only the confirm button sends; on success the sheet closes and the queue refreshes.
 */
export function RemoveReportedSheet({
  report,
  open,
  onClose,
}: {
  report: ModReport;
  open: boolean;
  onClose: () => void;
}) {
  const name = removableName(report.targetType) ?? "post";
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom">
        <RemoveForm report={report} name={name} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

function RemoveForm({
  report,
  name,
  onClose,
}: {
  report: ModReport;
  name: string;
  onClose: () => void;
}) {
  const remove = useRemoveReported();
  const confirm = useConfirm();
  return (
    <>
      <SheetHeader>
        <SheetTitle>Remove this {name}</SheetTitle>
        <SheetDescription>
          It stops showing to everyone and the reports on it close. An admin can reverse it from the
          audit log.
        </SheetDescription>
      </SheetHeader>
      <div className="px-5 pb-4">
        <ReasonForm
          id={`remove-reason-${report.id}`}
          submitLabel={`Remove ${name}`}
          variant="destructive"
          schema={removalBody}
          onCancel={onClose}
          onSubmit={(reason) =>
            confirm.ask({
              ...removeReportedConfirm(report, reason),
              run: async () => {
                await remove.mutateAsync({ id: report.id, reason });
                toast.success(`${name === "link" ? "Link" : "Request"} removed. Reports closed.`);
                onClose();
              },
            })
          }
        />
      </div>
      {confirm.element}
    </>
  );
}
