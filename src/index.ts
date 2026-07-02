import "reflect-metadata";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import * as dotenv from "dotenv";

import { AppDataSource } from "./data-source";
import { initSocket } from "./socket/socket";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routerV1 from "./routes";
import morganMiddleware from "./middleware/morgan";

dotenv.config();

async function bootstrap() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(helmet());
  app.use(
    cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(apiRateLimiter);
  app.use(morganMiddleware);

  // Serve uploaded event photos
  app.use(
    "/uploads",
    express.static(
      path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
    ),
  );

  app.get("/health", (_req, res) =>
    res.json({ status: "ok", time: new Date().toISOString() }),
  );

  app.get("/", (_req, res) => {
    res.json({ message: "Welcome to the Event Portal API" });
  });

  app.use("/api", routerV1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  initSocket(httpServer);

  await AppDataSource.initialize();
  console.log("Database connected");

  const port = Number(process.env.PORT) || 4000;
  httpServer.listen(port, () => {
    console.log(`Event Portal API running on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
