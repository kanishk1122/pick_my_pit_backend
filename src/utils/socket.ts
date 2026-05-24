import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { config } from "../config/index";

class SocketService {
    private io: Server | null = null;

    init(server: HttpServer) {
        this.io = new Server(server, {
            transports: ["websocket"], // Force websocket for zero-latency connection
            pingInterval: 10000,
            pingTimeout: 5000,
            connectTimeout: 10000,
            cors: {
                origin: (origin, callback) => {
                    // Allow all origins in development
                    callback(null, true);
                },
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        console.log("📡 Socket.IO initialized (WebSockets only)");
        return this.io;
    }

    getIO(): Server {
        if (!this.io) {
            throw new Error("Socket.IO not initialized!");
        }
        return this.io;
    }

    emit(event: string, data: any) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
}

export const socketService = new SocketService();
