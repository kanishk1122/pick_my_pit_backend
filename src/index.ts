import express from "express";
import { createServer } from "http";
// import { Server } from "socket.io";
// import { createAdapter } from "@socket.io/redis-adapter";
// import { createClient } from "redis";
// import { instrument } from "@socket.io/admin-ui";
import cookieParser from "cookie-parser";
import session from "express-session";
import { config } from "./config/index";
import { database } from "./config/database";
import { registerRoutes } from "./routes/index";
// import { registerSocketEvents } from "./sockets/index";

const app = express();
const server = createServer(app);

// --- START: Custom CORS Middleware ---
const customCors: express.RequestHandler = (req, res, next) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://192.168.29.217:5173",
    "http://192.168.29.217:3000",
  ];
  const origin = req.headers.origin;

  console.log("Request origin:", origin);
  console.log("Request cookies:", req.cookies);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
};
app.use(customCors);
// --- END: Custom CORS Middleware ---

// app.use((req, res, next) => {
//   console.log("Request URL:", req.originalUrl);
//   console.log("Headers:", req.headers);
//   console.log("cookies:", req.cookies);
//   console.log("method:", req.method);
//   next();
// });

// Body parsing middleware - INCREASED LIMIT
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie and session middleware
app.use(cookieParser());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false for HTTP (IP address access)
      httpOnly: true,
      sameSite: "lax", // Changed from default to 'lax' for cross-origin
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Request logging middleware
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
//   next();
// });

// Socket.IO setup
// const io = new Server(server, {
//   cors: {
//     origin: config.adminUiUrl,
//     credentials: true,
//   },
// });

// Redis setup for Socket.IO adapter
// const pubClient = createClient({ url: config.redisUrl });
// const subClient = pubClient.duplicate();

// Promise.all([pubClient.connect(), subClient.connect()]).catch(console.error);

// io.adapter(createAdapter(pubClient, subClient));

// Socket.IO Admin UI
// instrument(io, {
//   auth: false,
//   mode: "development",
//   namespaceName: "/admin",
// });

// Connect to database
database.connect().catch(console.error);

// Register routes and socket events

registerRoutes(app);
// registerSocketEvents(io);

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
server.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${config.port}`);
  console.log(
    `📡 Access on your network: http://192.168.29.217:${config.port}`
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
