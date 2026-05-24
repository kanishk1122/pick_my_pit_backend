# Messaging API Documentation

## Endpoints

### Send Message
**POST /api/messages/send**
Send a new message to another user.

**Request Body:**
```json
{
  "recipient": "user_id",
  "content": "Hello, this is a test message",
  "postId": "optional_post_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "message_id",
      "sender": "user_id",
      "recipient": "user_id",
      "content": "Hello, this is a test message",
      "read": false,
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  },
  "message": "Message sent successfully"
}
```

### Get Conversation
**GET /api/messages/conversation/:userId**
Retrieve conversation history between current user and another user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "message_id",
      "sender": "user_id",
      "recipient": "user_id",
      "content": "Hello",
      "read": true,
      "createdAt": "timestamp"
    }
  ],
  "message": "Conversation retrieved successfully"
}
```

### Get User Chats
**GET /api/messages/chats**
Get all chat conversations for the current user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "chat_id",
      "participants": ["user1_id", "user2_id"],
      "lastMessage": "Last message content",
      "lastMessageTimestamp": "timestamp",
      "unreadCount": {}
    }
  ],
  "message": "Chats retrieved successfully"
}
```

### Get Unread Count
**GET /api/messages/unread-count**
Get the number of unread messages for the current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  },
  "message": "Unread count retrieved successfully"
}
```

### Contact Pet Owner
**POST /api/messages/contact-pet-owner**
Contact a pet owner through a post listing.

**Request Body:**
```json
{
  "postId": "post_id",
  "message": "I'm interested in your pet listing"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "message_id",
      "sender": "user_id",
      "recipient": "pet_owner_id",
      "content": "I'm interested in your pet listing",
      "read": false,
      "createdAt": "timestamp"
    },
    "petOwner": {
      // pet owner details
    }
  },
  "message": "Message sent to pet owner successfully"
}
```

## Socket Events

### Client to Server

**join**
Join a user's personal room for messaging
```javascript
socket.emit('join', userId);
```

**send_message**
Send a message to another user
```javascript
socket.emit('send_message', {
  from: 'sender_user_id',
  to: 'recipient_user_id',
  content: 'message content'
});
```

**typing**
Send typing indicator
```javascript
socket.emit('typing', {
  from: 'sender_user_id',
  to: 'recipient_user_id',
  isTyping: true
});
```

**message_read**
Mark a message as read
```javascript
socket.emit('message_read', {
  messageId: 'message_id',
  sender: 'sender_user_id',
  recipient: 'recipient_user_id'
});
```

### Server to Client

**receive_message**
Receive a new message
```javascript
socket.on('receive_message', (data) => {
  // Handle received message
});
```

**user_typing**
Receive typing indicator
```javascript
socket.on('typing', (data) => {
  // Handle typing indicator
});
```

**message_read**
Receive message read confirmation
```javascript
socket.on('message_read', (data) => {
  // Handle read confirmation
});
```