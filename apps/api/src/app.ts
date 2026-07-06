import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth.routes";
import clubsRouter from "./routes/clubs.routes";
import companiesRouter from "./routes/companies.routes";
import membersRouter from "./routes/members.routes";
import mqttWebhookRouter from "./routes/mqtt-webhook.routes";
import sessionsRouter from "./routes/sessions.routes";
import hrRouter from "./routes/hr.routes";
import inviteRouter from "./routes/invite.routes";
import adminRouter from "./routes/admin.routes";
import workoutsRouter from "./routes/workouts.routes";
import workoutAssignmentsRouter from "./routes/workout-assignments";
import assetsRouter from "./routes/assets.routes";
import devicesRouter from "./routes/devices.routes";
import auditRouter from "./routes/audit.routes";

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3100",
      "http://127.0.0.1:3100",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.use("/api/auth", authRouter);

// Club management routes (super_admin only) — backward compat
app.use("/api/clubs", clubsRouter);

// Company management routes (super_admin only)
app.use("/api/companies", companiesRouter);

// Member and device routes (support both /companies and /clubs)
app.use("/api/companies", membersRouter);
app.use("/api/clubs", membersRouter);

// MQTT webhook routes (EMQX auth & ACL)
app.use("/api/mqtt", mqttWebhookRouter);

// Session routes
app.use("/api/sessions", sessionsRouter);
app.use("/api/companies", sessionsRouter);
app.use("/api/clubs", sessionsRouter);

// HR history routes
app.use("/api/companies", hrRouter);
app.use("/api/clubs", hrRouter);

// Invite routes
app.use("/api/companies", inviteRouter);
app.use("/api/clubs", inviteRouter);

// Admin + health check routes
app.use("/api", adminRouter);
app.use("/api/admin/audit-logs", auditRouter);

// Workout routes
app.use("/api/companies", workoutsRouter);

// Workout assignment routes
app.use("/api/companies", workoutAssignmentsRouter);

// Asset routes + static file serving
app.use("/api/companies", assetsRouter);

// Device routes
app.use("/api/companies", devicesRouter);

import path from "path";
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 404 handler
app.use((_req: Request, res: Response) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ERROR]", err.message, err.stack);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
});

export default app;
