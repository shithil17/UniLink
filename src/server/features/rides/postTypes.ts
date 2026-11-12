import { rides } from "../../db/schema";
import type { ModeratedPostType } from "../../moderation/postTypes";

/**
 * The screened fields, for the mod queue: the two landmarks and the notes. Area names are not user text.
 * Never a contact: those are checked for format by the rules step and only returned by the contact endpoint.
 */
const landmarksAndNotes = (row: Record<string, unknown>): string[] =>
  [row.pickupLandmark, row.destinationLandmark, row.notes].filter(
    (v): v is string => typeof v === "string" && v !== "",
  );

export const ridePostType: ModeratedPostType = {
  table: rides,
  screenedText: landmarksAndNotes,
};
