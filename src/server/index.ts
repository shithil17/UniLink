import { app } from "./app";

export default {
  fetch: app.fetch,
  // Cron Triggers fire in UTC. Jobs are registered here once they exist; the trigger list is empty for now.
  async scheduled() {},
} satisfies ExportedHandler<Env>;
