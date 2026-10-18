import { Hono } from "hono";
import { authRoutes } from "./features/auth/routes";
import { healthRoutes } from "./features/health/routes";
import { sessionLoader } from "./middleware/session";
import type { AppEnv } from "./middleware/types";

export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(sessionLoader)
  .route("/health", healthRoutes)
  .route("/auth", authRoutes);

export type AppType = typeof app;
