import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth.routes";
import clubsRouter from "./routes/clubs.routes";
import membersRouter from "./routes/members.routes";
import mqttWebhookRouter from "./routes/mqtt-webhook.routes";
import sessionsRouter from "./routes/sessions.routes";
import hrRouter from "./routes/hr.routes";
import inviteRouter from "./routes/invite.routes";
import adminRouter from "./routes/admin.routes";

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes
app.use("/api/auth", authRouter);

// Club management routes (super_admin only)
app.use("/api/clubs", clubsRouter);

// Member and device routes
app.use("/api/clubs", membersRouter);

// MQTT webhook routes (EMQX auth & ACL)
app.use("/api/mqtt", mqttWebhookRouter);

// Session routes
app.use("/api/sessions", sessionsRouter);
app.use("/api/clubs", sessionsRouter);

// HR history routes
app.use("/api/clubs", hrRouter);

// Invite routes (club_owner / trainer generate invite codes)
app.use("/api/clubs", inviteRouter);

// Admin + health check routes
app.use("/api", adminRouter);

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
