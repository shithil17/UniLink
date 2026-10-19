import { Badge } from "@/components/ui/badge";
import type { CourseMap } from "../../../shared/schemas/courses";

type Status = CourseMap["categories"][number]["slots"][number]["status"];

const CHIPS: Record<Status, { label: string; variant: "default" | "secondary" | "outline" }> = {
  done: { label: "Done", variant: "default" },
  available: { label: "Available", variant: "secondary" },
  locked: { label: "Locked", variant: "outline" },
};

export function StatusChip({ status }: { status: Status }) {
  const { label, variant } = CHIPS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** For a student's own course, which has no prerequisites: just done or not yet. */
export function DoneChip({ done }: { done: boolean }) {
  return done ? <Badge>Done</Badge> : <Badge variant="outline">Not done</Badge>;
}
