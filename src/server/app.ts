import { Hono } from "hono";
import { areaRoutes } from "./features/areas/routes";
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
import { placeRoutes } from "./features/places/routes";
import { postRoutes } from "./features/posts/routes";
import { pushRoutes } from "./features/push/routes";
import { resourceRoutes } from "./features/resources/routes";
import { rideRoutes } from "./features/rides/routes";
import { sessionLoader } from "./middleware/session";
import type { AppEnv } from "./middleware/types";

export const app = new Hono<AppEnv>()
  .basePath("/api")
  .use(sessionLoader)
  .route("/health", healthRoutes)
  .route("/auth", authRoutes)
  .route("/areas", areaRoutes)
  .route("/courses", courseRoutes)
  .route("/attempts", attemptRoutes)
  .route("/routine", routineRoutes)
  .route("/student-courses", studentCourseRoutes)
  .route("/faculty", facultyRoutes)
  .route("/inbox", inboxRoutes)
  .route("/push", pushRoutes)
  .route("/places", placeRoutes)
  .route("/posts", postRoutes)
  .route("/reports", reportRoutes)
  .route("/resources", resourceRoutes)
  .route("/rides", rideRoutes)
  .route("/mod", modRoutes)
  .route("/admin", adminRoutes);

export type AppType = typeof app;
