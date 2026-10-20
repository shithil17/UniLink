import { Hono } from "hono";
import { authRoutes } from "./features/auth/routes";
import { attemptRoutes } from "./features/attempts/routes";
import { courseRoutes, studentCourseRoutes } from "./features/courses/routes";
import { facultyRoutes } from "./features/faculty/routes";
import { healthRoutes } from "./features/health/routes";
import { inboxRoutes } from "./features/inbox/routes";
import { pushRoutes } from "./features/push/routes";
import { sessionLoader } from "./middleware/session";
import type { AppEnv } from "./middleware/types";

export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(sessionLoader)
  .route("/health", healthRoutes)
  .route("/auth", authRoutes)
  .route("/courses", courseRoutes)
  .route("/attempts", attemptRoutes)
  .route("/student-courses", studentCourseRoutes)
  .route("/faculty", facultyRoutes)
  .route("/inbox", inboxRoutes)
  .route("/push", pushRoutes);

export type AppType = typeof app;
