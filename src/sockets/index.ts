import { Server } from "socket.io";

export const registerSocketEvents = (io: Server): void => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join user to their personal room
    socket.on("join", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`👤 User ${userId} joined their personal room`);
    });

    socket.on("join_chat", (chatId: string) => {
      socket.join(`chat:${chatId}`);
      console.log(`💬 Socket joined chat room: ${chatId}`);
    });

    socket.on("leave_chat", (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      console.log(`👋 Socket left chat room: ${chatId}`);
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
      (data: { from: string; to: string; isTyping: boolean; chatId: string }) => {
        socket.to(`chat:${data.chatId}`).emit("typing", {
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

    // Handle message read receipts
    socket.on("message_read", (data: { messageId: string; chatId: string; sender: string }) => {
      socket.to(`chat:${data.chatId}`).emit("message_read_update", {
        messageId: data.messageId,
        readAt: new Date(),
      });
    });

    // Handle new message events
    socket.on("send_message", (data: { from: string; to: string; content: string; chatId: string; postId?: string }) => {
      // Emit to the chat room and the recipient's personal room
      io.to(`chat:${data.chatId}`).to(`user:${data.to}`).emit("receive_message", data);
    });
  });
};
