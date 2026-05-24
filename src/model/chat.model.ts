import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IChat extends Document {
  participants: Types.ObjectId[];
  post?: Types.ObjectId;
  lastMessage: string;
  lastMessageTimestamp: Date;
  unreadCount: Map<string, number>; // Track unread messages per participant
  createdAt: Date;
  updatedAt: Date;
  addParticipant(userId: Types.ObjectId): Promise<IChat>;
  removeParticipant(userId: Types.ObjectId): Promise<IChat>;
  updateLastMessage(message: string, timestamp: Date): Promise<IChat>;
}

export interface IChatMethods {
  addParticipant(userId: Types.ObjectId): Promise<IChat>;
  removeParticipant(userId: Types.ObjectId): Promise<IChat>;
  updateLastMessage(message: string, timestamp: Date): Promise<IChat>;
}

export interface IChatModel extends Model<IChat, {}, IChatMethods> {
  findOrCreateChat(user1: string, user2: string, postId?: string): Promise<IChat>;
  getChatsForUser(userId: string): Promise<IChat[]>;
}

const ChatSchema = new Schema<IChat, IChatModel, IChatMethods>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post"
    },
    lastMessage: {
      type: String,
      default: ""
    },
    lastMessageTimestamp: {
      type: Date
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying of user chats
ChatSchema.index({ participants: 1 });

ChatSchema.methods.addParticipant = function (this: IChat, userId: Types.ObjectId): Promise<IChat> {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
  }
  return this.save();
};

ChatSchema.methods.removeParticipant = function (this: IChat, userId: Types.ObjectId): Promise<IChat> {
  this.participants = this.participants.filter(
    (participant) => participant.toString() !== userId.toString()
  );
  return this.save();
};

ChatSchema.methods.updateLastMessage = function (
  this: IChat,
  message: string,
  timestamp: Date
): Promise<IChat> {
  this.lastMessage = message;
  this.lastMessageTimestamp = timestamp;
  return this.save();
};

ChatSchema.statics.findOrCreateChat = async function (
  user1: string,
  user2: string,
  postId?: string
): Promise<IChat> {
  // If postId is provided, search for chat between these users for THIS SPECIFIC POST
  let query: any = {
    participants: { $all: [user1, user2], $size: 2 }
  };
  
  if (postId) {
    query.post = postId;
  } else {
    // If no postId, look for a "general" chat (one without a post assigned)
    query.post = { $exists: false };
  }

  let chat = await this.findOne(query);

  // Create new chat if it doesn't exist
  if (!chat) {
    chat = new this({
      participants: [user1, user2],
      post: postId,
      unreadCount: {}
    });
    await chat.save();
  }

  return chat;
};

ChatSchema.statics.getChatsForUser = function (userId: string): Promise<IChat[]> {
  return this.find({ participants: { $in: [userId] } })
    .populate("participants", "firstname lastname userpic")
    .populate("post", "title images category price")
    .sort({ lastMessageTimestamp: -1 });
};

const ChatModel = mongoose.model<IChat, IChatModel>("Chat", ChatSchema);

export default ChatModel;