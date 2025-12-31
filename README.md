# 💬 Real-Time Chat Application with Socket.io

A scalable **real-time chat application** built with **Node.js, Express, React, and Socket.io**, demonstrating bidirectional communication, user presence, notifications, and modern chat features.

This project showcases how to design and implement **real-time systems** with WebSockets, focusing on performance, reliability, and user experience.

---

## 🚀 Features

### Core Features
- Real-time messaging using Socket.io  
- User authentication (username-based or JWT)  
- Global chat room for all users  
- Message timestamps and sender identification  
- Online / offline user presence  

### Advanced Features
- Private one-to-one messaging  
- Multiple chat rooms / channels  
- Typing indicators  
- Read receipts  
- Message reactions (like, love, etc.)  
- File or image sharing  

### Notifications & UX
- Real-time message notifications  
- Join/leave room notifications  
- Unread message count  
- Sound notifications  
- Browser notifications (Web Notifications API)  

### Performance & Reliability
- Message pagination for older chats  
- Automatic reconnection handling  
- Optimized Socket.io usage with rooms and namespaces  
- Message delivery acknowledgements  
- Responsive design for desktop and mobile  

---

## 🧠 Tech Stack

### Frontend
- React  
- Socket.io Client  
- Context API / Hooks  

### Backend
- Node.js  
- Express.js  
- Socket.io  
- JWT Authentication  

---

## 📂 Project Structure
socketio-chat/
├── client/ # React front-end
│ ├── public/ # Static assets
│ ├── src/
│ │ ├── components/ # Reusable UI components
│ │ ├── context/ # Global state management
│ │ ├── hooks/ # Custom hooks
│ │ ├── pages/ # Page-level components
│ │ ├── socket/ # Socket.io client setup
│ │ └── App.jsx # Root component
│ └── package.json
├── server/ # Node.js back-end
│ ├── config/ # Environment & app configuration
│ ├── controllers/ # Socket event handlers
│ ├── models/ # Data models
│ ├── socket/ # Socket.io server logic
│ ├── utils/ # Helper utilities
│ ├── server.js # Server entry point
│ └── package.json
└── README.md

---

## ⚙️ Getting Started

### Prerequisites
- Node.js **v18+**
- npm or yarn
- Modern web browser

---

### Installation

#### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/socketio-chat.git 
```

```bash
cd socketio-chat
```

#### 2️⃣ Install Server Dependencies
```bash
cd server
npm install 
```

#### 3️⃣ Install Client Dependencies
```bash cd ../client
npm install
```

### Running the Application
#### Start the Backend Server
```bash 
cd server
npm run dev
```

#### Start the Frontend
```bash
cd client
npm start
```


The application will be available at:
```bash
http://localhost:3000
```