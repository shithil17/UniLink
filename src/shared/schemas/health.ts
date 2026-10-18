import { z } from "zod";

export const healthResponse = z.object({
  ok: z.literal(true),
  dbVersion: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponse>;
