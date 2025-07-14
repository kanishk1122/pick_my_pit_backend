import { Server } from "socket.io";

export const registerSocketEvents = (io: Server): void => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join user to their personal room
    socket.on("join", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // Handle chat messages
    socket.on(
      "message",
      (data: {
        from: string;
        to: string;
        message: string;
        timestamp: Date;
      }) => {
        // Emit to specific user
        socket.to(`user:${data.to}`).emit("message", data);
        console.log(`Message from ${data.from} to ${data.to}: ${data.message}`);
      }
    );

    // Handle post updates
    socket.on(
      "post_update",
      (data: { postId: string; status: string; userId: string }) => {
        // Broadcast to all connected clients or specific rooms
        io.emit("post_status_changed", data);
        console.log(`Post ${data.postId} status changed to ${data.status}`);
      }
    );

    // Handle notifications
    socket.on(
      "notification",
      (data: { userId: string; type: string; message: string }) => {
        socket.to(`user:${data.userId}`).emit("notification", {
          type: data.type,
          message: data.message,
          timestamp: new Date(),
        });
      }
    );

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });

    // Handle typing indicators for chat
    socket.on(
      "typing",
      (data: { from: string; to: string; isTyping: boolean }) => {
        socket.to(`user:${data.to}`).emit("typing", {
          from: data.from,
          isTyping: data.isTyping,
        });
      }
    );

    // Handle admin events
    socket.on(
      "admin_action",
      (data: { action: string; target: string; details: any }) => {
        // Broadcast admin actions to relevant users
        if (data.target) {
          socket.to(`user:${data.target}`).emit("admin_notification", {
            action: data.action,
            details: data.details,
            timestamp: new Date(),
          });
        }
      }
    );
  });
};
