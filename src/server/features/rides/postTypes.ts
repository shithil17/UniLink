import { rides } from "../../db/schema";
import type { ModeratedPostType } from "../../moderation/postTypes";

/**
 * The screened fields, for the mod queue: pickup, destination and notes. Never a contact: those are
 * checked for format by the rules step and only returned by the contact endpoint.
 */
const placesAndNotes = (row: Record<string, unknown>): string[] =>
  [row.pickup, row.destination, row.notes].filter(
    (v): v is string => typeof v === "string" && v !== "",
  );

export const ridePostType: ModeratedPostType = {
  table: rides,
  screenedText: placesAndNotes,
};
