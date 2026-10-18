import { z } from "zod";
import { id, reasonCategory, reportTargetType } from "./common";

export const verdict = z.enum(["approve", "review", "reject"]);

export const screenResult = z.object({ verdict, category: reasonCategory });

export const reportRequest = z.object({
  targetType: reportTargetType,
  targetId: id,
  reason: z.string(),
});
