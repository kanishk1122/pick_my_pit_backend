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
import { registerSocketEvents } from "./sockets/index";
import { socketService } from "./utils/socket";
import { startPostWorker } from "./workers/postWorker";

if (process.env.NODE_ENV === "production") {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

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

  // console.log("Request origin:", origin);
  // console.log("Request cookies:", req.headers.cookie);
  // console.log("got req ");

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
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const setupRedisAdapter = async () => {
  try {
    const redisUrl = config.redisUrl || "redis://localhost:6380";
    console.log(`🔌 Attempting to connect to Redis at ${redisUrl}...`);
    
    const pubClient = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log("⚠️ Redis connection failed after 3 attempts. Falling back to Memory Adapter.");
            return false; // Stop retrying
          }
          return 500; // retry every 500ms
        }
      }
    });
    
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED') console.log('Redis Pub Client Error:', err.message);
    });
    subClient.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED') console.log('Redis Sub Client Error:', err.message);
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    const io = socketService.getIO();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("🔄 Redis Socket.IO adapter connected successfully");
  } catch (err: any) {
    console.log("❌ Redis connection failed. Messaging will work but will be limited to this instance.");
  }
};

setupRedisAdapter();

// Socket.IO Admin UI
// instrument(io, {
//   auth: false,
//   mode: "development",
//   namespaceName: "/admin",
// });

// Connect to database
database.connect().then(() => {
  // Initialize Sockets
  const io = socketService.init(server);
  registerSocketEvents(io);

  // Start background services
  import("./utils/redis").then(m => m.redisService.connect());

  // Start BullMQ Background Post Processing Worker
  startPostWorker();
}).catch(console.error);

// Register routes
registerRoutes(app);

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
  console.log(`🚀 Server is running on http://localhost:${config.port}`);
  console.log(
    `📡 Access on your network: http://localhost:${config.port}`
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
