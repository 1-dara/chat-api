# 💬 Real-Time Chat API

A real-time chat backend built with **TypeScript**, **Node.js**, **Socket.io**, and **MongoDB**. Supports multiple chat rooms, live messaging, chat history, and JWT-authenticated WebSocket connections.

🔗 **Live API:** https://chat-api-udxb.onrender.com
💻 **GitHub:** https://github.com/1-dara/chat-api

---

## Features

- **JWT WebSocket Auth** — token verified on WebSocket handshake before connection is established
- **Multiple Chat Rooms** — users can join and leave named rooms dynamically
- **Real-time Messaging** — messages broadcast instantly to all room members via Socket.io
- **Chat History** — last 50 messages delivered on room join so users see recent context
- **User Presence** — join and leave notifications sent to room members
- **Message Persistence** — all messages stored in MongoDB for history retrieval

---

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Language |
| Node.js | Runtime |
| Express | HTTP server |
| Socket.io | WebSocket real-time communication |
| MongoDB | Database |
| Mongoose | ODM |
| JWT | Authentication |
| Render | Deployment |
| MongoDB Atlas | Cloud database |

---

## WebSocket Events

### Client Emits (sends to server)
| Event | Payload | Description |
|---|---|---|
| `join_room` | `roomName: string` | Join a chat room |
| `send_message` | `{ roomName, content }` | Send a message to a room |
| `leave_room` | `roomName: string` | Leave a chat room |

### Server Emits (sends to client)
| Event | Payload | Description |
|---|---|---|
| `room_history` | `{ room, messages[] }` | Last 50 messages on join |
| `new_message` | `{ id, content, sender, room, createdAt }` | New message in room |
| `user_joined` | `{ username, room }` | User joined notification |
| `user_left` | `{ username, room }` | User left notification |
| `error` | `{ message }` | Error notification |

---

## REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |

---

## How to Connect

```javascript
import { io } from 'socket.io-client';

const socket = io('YOUR_RENDER_URL', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('join_room', 'general');
socket.on('room_history', (data) => console.log(data));
socket.on('new_message', (msg) => console.log(msg));
socket.emit('send_message', { roomName: 'general', content: 'Hello!' });
```

---

## Setup & Installation

1. Clone the repo
```bash
git clone https://github.com/1-dara/chat-api.git
cd chat-api
```

2. Install dependencies
```bash
npm install
```

3. Create `.env`
```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key
PORT=3003
```

4. Start the server
```bash
npm run dev
```

---

## Author

**Irene Peter-Okon Idara**
Software Developer
 1ireneokon@gmail.com
 github.com/1-dara