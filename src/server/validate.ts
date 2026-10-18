import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

/** Validates the JSON body with a shared schema. A bad body is a 400 whose message is the first issue. */
export const validateJson = <T extends z.ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "invalid_request", message: result.error.issues[0]?.message ?? "Invalid request" },
        400,
      );
    }
  });
