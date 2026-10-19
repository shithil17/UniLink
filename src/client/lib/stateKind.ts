import type { CourseStatus } from "../../shared/schemas/courses";

/** The four course states. A done course filled through a waiver is its own state: waived. */
export type StateKind = CourseStatus | "waived";

export const STATE_LABEL: Record<StateKind, string> = {
  done: "Done",
  available: "Available",
  locked: "Locked",
  waived: "Waived",
};

/** The state a course shows: a done course with the waived flag is waived, anything else is its status. */
export function stateKind(status: CourseStatus, waived = false): StateKind {
  return status === "done" && waived ? "waived" : status;
}
