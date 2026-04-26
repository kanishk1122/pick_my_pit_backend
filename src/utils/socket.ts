import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { config } from "../config/index";

class SocketService {
    private io: Server | null = null;

    init(server: HttpServer) {
        this.io = new Server(server, {
            cors: {
                origin: [
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "http://localhost:3001",
                    config.adminUiUrl
                ],
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        console.log("📡 Socket.IO initialized");
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
