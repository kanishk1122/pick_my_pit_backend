import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { instrument } from "@socket.io/admin-ui";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { config } from "./config/index.js";
import { database } from "./config/database.js";
import { registerRoutes } from "./routes/index.js";
import { registerSocketEvents } from "./sockets/index.js";

const app = express();
const server = createServer(app);

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ limit: "12mb", extended: true }));

// Cookie and session middleware
app.use(cookieParser());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: config.adminUiUrl,
    credentials: true,
  },
});

// Redis setup for Socket.IO adapter
const pubClient = createClient({ url: config.redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).catch(console.error);

io.adapter(createAdapter(pubClient, subClient));

// Socket.IO Admin UI
instrument(io, {
  auth: false,
  mode: "development",
  namespaceName: "/admin",
});

// Connect to database
database.connect().catch(console.error);

// Register routes and socket events
registerRoutes(app);
registerSocketEvents(io);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Server is running on port ${config.port}`);
  // console.log(`📊 Admin UI available at http://localhost:${config.port}/admin`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
