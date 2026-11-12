// The word for what a moderator removes, by target type. One map so the audit log, the confirm
// sheets and the queue all call a removed request a "request" and a removed link a "link".

const REMOVED_NAME = { resource_request: "request", resource_submission: "link" } as const;

export type RemovedName = (typeof REMOVED_NAME)[keyof typeof REMOVED_NAME];

/** "request" or "link" for a target a mod can remove, or null for any other target type. */
export function removedName(targetType: string): RemovedName | null {
  return Object.hasOwn(REMOVED_NAME, targetType)
    ? REMOVED_NAME[targetType as keyof typeof REMOVED_NAME]
    : null;
}
