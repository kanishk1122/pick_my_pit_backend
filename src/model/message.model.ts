import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  content: string;
  post?: Types.ObjectId; // Optional reference to the pet post
  chatId?: Types.ObjectId; // Reference to the chat/conversation
  timestamp: Date;
  readAt: Date;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageMethods {
  markAsRead(): Promise<IMessage>;
}

export interface IMessageModel extends Model<IMessage, {}, IMessageMethods> {
  getUnreadCount(userId: string): Promise<number>;
  getConversation(user1: string, user2: string): Promise<IMessage[]>;
}

const MessageSchema = new Schema<IMessage, IMessageModel, IMessageMethods>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post"
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat"
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying of conversations between users
MessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

// Index for efficient unread message counting
MessageSchema.index({ recipient: 1, read: 1 });

MessageSchema.methods.markAsRead = function (this: IMessage): Promise<IMessage> {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

MessageSchema.statics.getUnreadCount = function (userId: string): Promise<number> {
  return this.countDocuments({ recipient: userId, read: false });
};

MessageSchema.statics.getConversation = function (
  user1: string,
  user2: string
): Promise<IMessage[]> {
  const u1 = new mongoose.Types.ObjectId(user1);
  const u2 = new mongoose.Types.ObjectId(user2);
  
  return this.find({
    $or: [
      { sender: u1, recipient: u2 },
      { sender: u2, recipient: u1 }
    ]
  }).sort({ createdAt: 1 });
};

const MessageModel = mongoose.model<IMessage, IMessageModel>("Message", MessageSchema);

export default MessageModel;