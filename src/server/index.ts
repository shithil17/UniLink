import { app } from "./app";
import { scheduled } from "./cron";

export default {
  fetch: app.fetch,
  // Cron Triggers fire in UTC; the jobs live in cron.ts.
  scheduled,
} satisfies ExportedHandler<Env>;
