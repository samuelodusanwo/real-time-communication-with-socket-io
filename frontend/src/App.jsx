import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Smile, Search, Settings, Users, Bell, Wifi, Menu, X, MessageCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([
    { id: 1, name: 'general', unread: 0, active: true },
    { id: 2, name: 'random', unread: 3, active: false },
    { id: 3, name: 'tech', unread: 0, active: false },
    { id: 4, name: 'support', unread: 7, active: false },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [currentUser, setCurrentUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [notifications, setNotifications] = useState([]);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Socket.io connection and event handlers
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true
    });

    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Connected to server');
      
      // Join with a random username
      const username = `User${Math.floor(Math.random() * 1000)}`;
      newSocket.emit('user-join', { username });
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (error) => {
      setConnectionStatus('error');
      console.error('Connection error:', error);
    });

    // Chat events
    newSocket.on('user-registered', (user) => {
      setCurrentUser(user);
      console.log('User registered:', user);
    });

    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, { 
        ...message, 
        isOwn: message.user === currentUser?.username,
        time: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    newSocket.on('user-typing', (data) => {
      setIsTyping(data.isTyping);
      setTypingUser(data.user);
    });

    newSocket.on('online-users-update', (users) => {
      setOnlineUsers(users.map(user => ({
        id: user.id,
        name: user.username,
        status: user.online ? 'online' : 'offline',
        unread: 0
      })));
    });

    newSocket.on('user-joined', (data) => {
      addNotification(`${data.user} joined the chat`, 'info');
    });

    newSocket.on('user-left', (data) => {
      addNotification(`${data.user} left the chat`, 'info');
    });

    newSocket.on('room-history', (data) => {
      setMessages(data.messages.map(msg => ({
        ...msg,
        isOwn: msg.user === currentUser?.username,
        time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
    });

    newSocket.on('private-message-received', (message) => {
      setMessages(prev => [...prev, {
        id: message.id,
        user: message.isOwn ? 'You' : message.from,
        text: message.text,
        time: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
        isOwn: message.isOwn || false,
        isPrivate: true
      }]);
      addNotification(`Private message from ${message.from}`, 'message');
    });

    newSocket.on('message-reaction-added', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { 
              ...msg, 
              reactions: [...(msg.reactions || []), data.reaction] 
            }
          : msg
      ));
    });

    return () => {
      newSocket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Update currentUser in dependency for message ownership
  useEffect(() => {
    if (socket && currentUser) {
      // Re-setup message handlers with current user context
      socket.off('new-message');
      socket.on('new-message', (message) => {
        setMessages(prev => [...prev, { 
          ...message, 
          isOwn: message.user === currentUser.username,
          time: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      });
    }
  }, [currentUser, socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      // Send message via socket
      socket.emit('send-message', {
        text: newMessage.trim()
      });

      setNewMessage('');
      
      // Stop typing indicator
      socket.emit('typing-stop');
      setIsTyping(false);
      
      // Auto-close sidebar on mobile after sending
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing-start');
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing-stop');
        setIsTyping(false);
      }, 1000);
    }
  };

  const addReaction = (messageId, reaction) => {
    if (socket) {
      socket.emit('message-reaction', {
        messageId: messageId,
        reaction: reaction
      });
    }
  };

  const joinRoom = (roomName) => {
    if (socket) {
      socket.emit('join-room', { roomName });
      setRooms(prev => prev.map(room => ({
        ...room,
        active: room.name === roomName
      })));
    }
  };

  const sendPrivateMessage = (toUser, text) => {
    if (socket) {
      socket.emit('private-message', {
        toUser: toUser,
        text: text
      });
    }
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      case 'away': return '🟡';
      default: return '⚪';
    }
  };

  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      default: return '';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'disconnected': return 'text-red-400';
      case 'error': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Connecting...';
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const activeRoom = rooms.find(room => room.active) || rooms[0];

  return (
    <div className='mx-auto w-full bg-gray-900'>
      <div className="flex flex-col h-screen bg-gray-900 text-white max-w-[2000px] mx-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center space-x-2">
            <MessageCircle size={20} className="text-blue-400" />
            <h1 className="text-lg font-semibold">Chat App</h1>
          </div>
          
          <div className="w-10">
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-800 px-4 py-2 text-xs flex justify-between items-center">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            {notifications.slice(-1).map(notification => (
              <span key={notification.id} className="flex items-center space-x-1">
                <Bell size={14} />
                <span className="hidden sm:inline">{notification.message}</span>
                <span className="sm:hidden">New activity</span>
              </span>
            ))}
            <span className="flex items-center space-x-1">
              <Users size={14} />
              <span>{onlineUsers.filter(u => u.status === 'online').length} online</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`hidden sm:flex items-center space-x-1 ${getConnectionStatusColor()}`}>
              <Wifi size={14} />
              <span>{getConnectionStatusText()}</span>
            </span>
            <span className={getConnectionStatusColor().replace('text-', 'text-')}>●</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Overlay for Mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed md:static inset-y-0 left-0 z-50
            w-64 bg-gray-800 transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            flex flex-col
          `}>
            {/* Mobile Sidebar Header */}
            <div className="md:hidden p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* View Toggle for Mobile */}
            <div className="md:hidden flex border-b border-gray-700">
              <button
                onClick={() => setActiveView('users')}
                className={`flex-1 py-3 text-center ${
                  activeView === 'users' ? 'bg-gray-700 text-blue-400' : 'hover:bg-gray-700'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveView('rooms')}
                className={`flex-1 py-3 text-center ${
                  activeView === 'rooms' ? 'bg-gray-700 text-blue-400' : 'hover:bg-gray-700'
                }`}
              >
                Rooms
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Online Users - Hidden on mobile when not active */}
              <div className={`p-4 border-b border-gray-700 ${activeView !== 'users' ? 'hidden md:block' : 'block'}`}>
                <h3 className="font-semibold text-sm text-gray-400 mb-3 flex items-center">
                  <Users size={16} className="mr-2" />
                  ONLINE USERS ({onlineUsers.filter(u => u.status === 'online').length})
                </h3>
                <div className="space-y-2">
                  {onlineUsers.map(user => (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between hover:bg-gray-700 p-2 rounded cursor-pointer"
                      onClick={() => {
                        const message = prompt(`Send private message to ${user.name}:`);
                        if (message && socket) {
                          sendPrivateMessage(user.name, message);
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-xs flex-shrink-0">{getStatusIcon(user.status)}</span>
                        <span className="text-sm truncate">{user.name}</span>
                        {user.name === currentUser?.username && (
                          <span className="text-xs text-blue-400">(You)</span>
                        )}
                      </div>
                      {user.unread > 0 && (
                        <span className="bg-blue-500 text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">
                          {user.unread}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rooms - Hidden on mobile when not active */}
              <div className={`p-4 flex-1 ${activeView !== 'rooms' ? 'hidden md:block' : 'block'}`}>
                <h3 className="font-semibold text-sm text-gray-400 mb-3">CHAT ROOMS</h3>
                <div className="space-y-1">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => joinRoom(room.name)}
                      className={`flex items-center justify-between p-3 rounded cursor-pointer ${
                        room.active ? 'bg-blue-600' : 'hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-sm truncate">#{room.name}</span>
                      </div>
                      {room.unread > 0 && (
                        <span className="bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">
                          {room.unread}
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="p-3 text-blue-400 hover:text-blue-300 cursor-pointer text-sm">
                    + Create new room
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-gray-900 min-w-0">
            {/* Chat Header */}
            <div className="bg-gray-800 px-4 py-3 flex justify-between items-center border-b border-gray-700">
              <div className="flex items-center space-x-3 min-w-0">
                <button 
                  onClick={toggleSidebar}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold truncate">#{activeRoom.name}</h2>
                  <span className="text-green-400 text-sm">● {onlineUsers.filter(u => u.status === 'online').length} online</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
                  <Search size={20} />
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
                  <Settings size={20} />
                </button>
                <div className="hidden sm:flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold">
                      {currentUser?.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="text-sm hidden lg:inline">
                    {currentUser?.username || 'User1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-xs lg:max-w-md rounded-lg p-3 ${
                        message.isOwn
                          ? 'bg-blue-600 rounded-br-none'
                          : 'bg-gray-700 rounded-bl-none'
                      } ${message.isPrivate ? 'border-2 border-purple-500' : ''}`}
                    >
                      {!message.isOwn && (
                        <div className="font-semibold text-sm text-blue-300 mb-1">
                          {message.user}
                          {message.isPrivate && (
                            <span className="text-xs text-purple-300 ml-2">(Private)</span>
                          )}
                        </div>
                      )}
                      <div className="text-white break-words">{message.text}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-400">
                          {message.time}
                        </span>
                        {message.isOwn && (
                          <span className="text-xs text-gray-300 ml-2">
                            {getMessageStatusIcon(message.status)}
                          </span>
                        )}
                      </div>
                      
                      {/* Message Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.reactions.map((reaction, index) => (
                            <span key={index} className="text-xs bg-gray-600 px-2 py-1 rounded">
                              {reaction}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Reaction Picker */}
                      {!message.isOwn && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {['❤️', '👍', '🎉', '😂'].map((reaction) => (
                            <button
                              key={reaction}
                              onClick={() => addReaction(message.id, reaction)}
                              className="text-xs hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                            >
                              {reaction}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 rounded-lg rounded-bl-none p-3 max-w-[85%] sm:max-w-xs">
                    <div className="text-sm text-gray-400">
                      {typingUser} is typing...
                      <span className="inline-flex ml-2 space-x-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce delay-100">.</span>
                        <span className="animate-bounce delay-200">.</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-gray-800 p-4 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2 sm:space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type your message..."
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 pr-20 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!socket || connectionStatus !== 'connected'}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                    <button type="button" className="p-2 text-gray-400 hover:text-white transition-colors">
                      <Paperclip size={18} />
                    </button>
                    <button type="button" className="p-2 text-gray-400 hover:text-white transition-colors">
                      <Smile size={18} />
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 sm:px-6 py-3 flex items-center space-x-1 sm:space-x-2 transition-colors flex-shrink-0 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  disabled={!newMessage.trim() || !socket || connectionStatus !== 'connected'}
                >
                  <Send size={18} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;