import { Badge } from "@/components/ui/badge";
import type { CourseStatus as Status } from "../../../shared/schemas/courses";

const CHIPS: Record<Status, { label: string; variant: "default" | "secondary" | "outline" }> = {
  done: { label: "Done", variant: "default" },
  available: { label: "Available", variant: "secondary" },
  locked: { label: "Locked", variant: "outline" },
};

/** A done course that was waived says so instead of "Done". */
export function StatusChip({ status, waived = false }: { status: Status; waived?: boolean }) {
  const { label, variant } = CHIPS[status];
  return <Badge variant={variant}>{status === "done" && waived ? "Waived" : label}</Badge>;
}

/** For a student's own course, which has no prerequisites: just done or not yet. */
export function DoneChip({ done, waived = false }: { done: boolean; waived?: boolean }) {
  return done ? (
    <Badge>{waived ? "Waived" : "Done"}</Badge>
  ) : (
    <Badge variant="outline">Not done</Badge>
  );
}
