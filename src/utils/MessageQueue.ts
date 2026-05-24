import { socketService } from "./socket";

/**
 * MessageQueueSystem
 * Implements a 3-tier logical queue system for high-availability message delivery.
 * 
 * Distribution Logic (Round Robin):
 * Queue 1: Users 1, 4, 7...
 * Queue 2: Users 2, 5, 8...
 * Queue 3: Users 3, 6, 9...
 */
class MessageQueueSystem {
  private queues: Map<number, any[]> = new Map();
  private processing: boolean[] = [false, false, false, false]; // Thread 0 reserved for TS/Node, 1-3 for Messages

  constructor() {
    this.queues.set(1, []);
    this.queues.set(2, []);
    this.queues.set(3, []);
  }

  /**
   * Assigns a user to a logical queue (1, 2, or 3)
   */
  private getQueueId(userId: string): number {
    // Convert hex string ID to a number for round-robin
    const charSum = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (charSum % 3) + 1;
  }

  /**
   * Enqueue a message for delivery
   */
  public enqueue(messageData: any) {
    const queueId = this.getQueueId(messageData.to);
    console.log(`[QueueSystem] 📥 Enqueuing message for user ${messageData.to} into Queue ${queueId}`);
    
    this.queues.get(queueId)?.push(messageData);
    this.processQueue(queueId);
  }

  /**
   * Processes messages in a specific queue
   */
  private async processQueue(queueId: number) {
    if (this.processing[queueId]) return;
    
    this.processing[queueId] = true;
    const queue = this.queues.get(queueId);

    while (queue && queue.length > 0) {
      const message = queue.shift();
      if (message) {
        try {
          await this.deliverMessage(message, queueId);
        } catch (error) {
          console.error(`[QueueSystem] ❌ Failed to deliver message in Queue ${queueId}:`, error);
        }
      }
    }

    this.processing[queueId] = false;
  }

  /**
   * Final delivery logic
   */
  private async deliverMessage(data: any, queueId: number) {
    const io = socketService.getIO();
    
    // Ensure all IDs are strings to prevent frontend state mismatches
    const payload = {
      ...data,
      _id: data._id?.toString(),
      chatId: data.chatId?.toString(),
      from: data.from?.toString(),
      to: data.to?.toString()
    };
    
    console.log(`[QueueSystem] 🛠️ Delivering to rooms: chat:${payload.chatId} and user:${payload.to}`);
    console.log(`[QueueSystem] 📦 Payload:`, JSON.stringify(payload, null, 2));

    // Deliver to the specific chat room
    if (payload.chatId) {
      const chatRoom = `chat:${payload.chatId}`;
      io.to(chatRoom).emit("receive_message", payload);
      console.log(`[QueueSystem] 📤 Emitted to ${chatRoom}`);
    }
    
    // Deliver to recipient's personal room for notification
    if (payload.to) {
      const userRoom = `user:${payload.to}`;
      io.to(userRoom).emit("receive_message", payload);
      console.log(`[QueueSystem] 📤 Emitted to ${userRoom}`);
    }
    
    console.log(`[QueueSystem] 🚀 Message Delivery complete via Queue ${queueId}`);
  }
}

export const messageQueue = new MessageQueueSystem();
