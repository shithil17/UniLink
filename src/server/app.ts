import { Hono } from "hono";
import { authRoutes } from "./features/auth/routes";
import { attemptRoutes } from "./features/attempts/routes";
import { routineRoutes } from "./features/routine/routes";
import { courseRoutes, studentCourseRoutes } from "./features/courses/routes";
import { facultyRoutes } from "./features/faculty/routes";
import { healthRoutes } from "./features/health/routes";
import { inboxRoutes } from "./features/inbox/routes";
import { adminRoutes } from "./features/mod/adminRoutes";
import { modRoutes } from "./features/mod/routes";
import { reportRoutes } from "./features/mod/reportRoutes";
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
  .route("/routine", routineRoutes)
  .route("/student-courses", studentCourseRoutes)
  .route("/faculty", facultyRoutes)
  .route("/inbox", inboxRoutes)
  .route("/push", pushRoutes)
  .route("/reports", reportRoutes)
  .route("/mod", modRoutes)
  .route("/admin", adminRoutes);

export type AppType = typeof app;
