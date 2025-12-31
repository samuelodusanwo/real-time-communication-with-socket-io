const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Your React app URL
    methods: ["GET", "POST"]
  }
});

// In-memory storage
const users = new Map(); // userId -> user data
const rooms = new Map(); // roomName -> room data
const privateConversations = new Map(); // conversationId -> conversation data

// Initialize default rooms
const defaultRooms = ['general', 'random', 'tech', 'support'];
defaultRooms.forEach(roomName => {
  rooms.set(roomName, {
    id: roomName,
    name: roomName,
    users: new Set(),
    messages: [],
    createdAt: new Date()
  });
});

// Utility functions
const getUserBySocketId = (socketId) => {
  for (let [userId, user] of users) {
    if (user.socketId === socketId) return user;
  }
  return null;
};

const getUserById = (userId) => {
  return users.get(userId);
};

const getOnlineUsers = () => {
  return Array.from(users.values()).filter(user => user.online);
};

const broadcastOnlineUsers = () => {
  const onlineUsers = getOnlineUsers();
  io.emit('online-users-update', onlineUsers);
};

const createMessage = (user, text, room = null, isPrivate = false) => {
  return {
    id: uuidv4(),
    user: user.username,
    userId: user.id,
    text: text,
    room: room,
    timestamp: new Date(),
    status: 'delivered',
    isPrivate: isPrivate
  };
};

const getPrivateConversationId = (user1, user2) => {
  return [user1.id, user2.id].sort().join('_');
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user registration
  socket.on('user-join', (userData) => {
    const userId = uuidv4();
    const user = {
      id: userId,
      socketId: socket.id,
      username: userData.username || `User-${userId.slice(0, 8)}`,
      online: true,
      currentRoom: 'general',
      joinedAt: new Date(),
      lastSeen: new Date()
    };

    users.set(userId, user);
    
    // Join default room
    socket.join('general');
    const room = rooms.get('general');
    if (room) {
      room.users.add(userId);
    }

    // Send user their info
    socket.emit('user-registered', user);

    // Broadcast online users update
    broadcastOnlineUsers();

    // Notify room about new user
    socket.to('general').emit('user-joined', {
      user: user.username,
      message: `${user.username} joined the chat`,
      timestamp: new Date(),
      onlineUsers: getOnlineUsers().length
    });

    // Send room history
    if (room) {
      socket.emit('room-history', {
        room: 'general',
        messages: room.messages.slice(-100) // Last 100 messages
      });
    }

    console.log(`User ${user.username} joined general room`);
  });

  // Handle message sending
  socket.on('send-message', (messageData) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const message = createMessage(user, messageData.text, user.currentRoom);
    const room = rooms.get(user.currentRoom);
    
    if (room) {
      room.messages.push(message);
      
      // Broadcast to room
      io.to(user.currentRoom).emit('new-message', message);
      
      console.log(`Message from ${user.username} in ${user.currentRoom}: ${message.text}`);
    }
  });

  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    socket.to(user.currentRoom).emit('user-typing', {
      user: user.username,
      isTyping: true
    });
  });

  socket.on('typing-stop', () => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    socket.to(user.currentRoom).emit('user-typing', {
      user: user.username,
      isTyping: false
    });
  });

  // Handle room switching
  socket.on('join-room', (roomData) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const oldRoom = user.currentRoom;
    const newRoom = roomData.roomName;

    // Leave old room
    if (oldRoom) {
      socket.leave(oldRoom);
      const oldRoomObj = rooms.get(oldRoom);
      if (oldRoomObj) {
        oldRoomObj.users.delete(user.id);
        
        // Notify old room
        socket.to(oldRoom).emit('user-left-room', {
          user: user.username,
          room: oldRoom,
          message: `${user.username} left the room`,
          timestamp: new Date()
        });
      }
    }

    // Join new room (create if doesn't exist)
    if (!rooms.has(newRoom)) {
      rooms.set(newRoom, {
        id: newRoom,
        name: newRoom,
        users: new Set(),
        messages: [],
        createdAt: new Date()
      });
    }

    const newRoomObj = rooms.get(newRoom);
    newRoomObj.users.add(user.id);
    user.currentRoom = newRoom;
    socket.join(newRoom);

    // Notify new room
    socket.to(newRoom).emit('user-joined-room', {
      user: user.username,
      room: newRoom,
      message: `${user.username} joined the room`,
      timestamp: new Date()
    });

    // Send room history to user
    socket.emit('room-history', {
      room: newRoom,
      messages: newRoomObj.messages.slice(-100)
    });

    // Send room info
    socket.emit('room-joined', {
      room: newRoom,
      users: Array.from(newRoomObj.users).map(id => getUserById(id)).filter(u => u)
    });

    console.log(`User ${user.username} moved from ${oldRoom} to ${newRoom}`);
  });

  // Handle private messages
  socket.on('private-message', (data) => {
    const fromUser = getUserBySocketId(socket.id);
    if (!fromUser) return;

    const toUser = Array.from(users.values()).find(u => u.username === data.toUser && u.online);
    if (!toUser) {
      // Notify sender that user is offline
      socket.emit('private-message-error', {
        error: 'User is offline',
        toUser: data.toUser
      });
      return;
    }

    const conversationId = getPrivateConversationId(fromUser, toUser);
    const message = createMessage(fromUser, data.text, null, true);

    // Store private message
    if (!privateConversations.has(conversationId)) {
      privateConversations.set(conversationId, {
        id: conversationId,
        users: [fromUser.id, toUser.id],
        messages: []
      });
    }

    const conversation = privateConversations.get(conversationId);
    conversation.messages.push(message);

    // Send to recipient
    io.to(toUser.socketId).emit('private-message-received', {
      ...message,
      from: fromUser.username,
      to: toUser.username
    });
    
    // Send back to sender for their own chat
    socket.emit('private-message-received', {
      ...message,
      from: fromUser.username,
      to: toUser.username,
      isOwn: true
    });

    console.log(`Private message from ${fromUser.username} to ${toUser.username}`);
  });

  // Handle message reactions
  socket.on('message-reaction', (data) => {
    const user = getUserBySocketId(socket.id);
    if (!user) return;

    const room = rooms.get(user.currentRoom);
    if (room) {
      const message = room.messages.find(m => m.id === data.messageId);
      if (message) {
        if (!message.reactions) message.reactions = [];
        
        // Remove existing reaction from same user
        message.reactions = message.reactions.filter(r => r.userId !== user.id);
        
        // Add new reaction
        message.reactions.push({
          reaction: data.reaction,
          user: user.username,
          userId: user.id,
          timestamp: new Date()
        });

        // Broadcast reaction to room
        io.to(user.currentRoom).emit('message-reaction-added', {
          messageId: data.messageId,
          reaction: data.reaction,
          user: user.username
        });
      }
    }
  });

  // Handle user activity
  socket.on('user-activity', (data) => {
    const user = getUserBySocketId(socket.id);
    if (user) {
      user.lastActivity = new Date();
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    const user = getUserBySocketId(socket.id);
    if (user) {
      user.online = false;
      user.lastSeen = new Date();
      user.socketId = null;

      // Notify rooms user was in
      const room = rooms.get(user.currentRoom);
      if (room) {
        room.users.delete(user.id);
        socket.to(user.currentRoom).emit('user-left', {
          user: user.username,
          message: `${user.username} left the chat`,
          timestamp: new Date(),
          onlineUsers: getOnlineUsers().length
        });
      }

      broadcastOnlineUsers();
      console.log(`User ${user.username} disconnected: ${reason}`);
    } else {
      console.log(`Unknown user disconnected: ${socket.id}`);
    }
  });

  // Handle reconnection
  socket.on('reconnect-user', (userData) => {
    const user = Array.from(users.values()).find(u => u.id === userData.userId);
    if (user) {
      user.socketId = socket.id;
      user.online = true;
      socket.join(user.currentRoom);
      
      broadcastOnlineUsers();
      console.log(`User ${user.username} reconnected`);
    }
  });
});

// HTTP Routes
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    userCount: room.users.size,
    messageCount: room.messages.length,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

app.get('/api/users/online', (req, res) => {
  res.json(getOnlineUsers());
});

app.get('/api/users/:userId', (req, res) => {
  const user = getUserById(req.params.userId);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  if (rooms.has(name)) {
    return res.status(409).json({ error: 'Room already exists' });
  }

  const room = {
    id: name,
    name: name,
    users: new Set(),
    messages: [],
    createdAt: new Date()
  };

  rooms.set(name, room);
  res.status(201).json(room);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    users: {
      total: users.size,
      online: getOnlineUsers().length
    },
    rooms: rooms.size,
    privateConversations: privateConversations.size,
    timestamp: new Date() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💬 Chat backend ready for connections`);
  console.log(`📊 Default rooms: ${defaultRooms.join(', ')}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// Cleanup inactive users (optional)
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (let [userId, user] of users) {
    if (user.online && user.lastActivity && (now - user.lastActivity) > inactiveThreshold) {
      user.online = false;
      console.log(`Marked user ${user.username} as inactive`);
    }
  }
  
  broadcastOnlineUsers();
}, 5 * 60 * 1000); // Check every 5 minutes