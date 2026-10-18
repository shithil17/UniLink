import { Hono } from "hono";
import { healthRoutes } from "./features/health/routes";

export const app = new Hono<{ Bindings: Env }>().basePath("/api").route("/health", healthRoutes);

export type AppType = typeof app;
