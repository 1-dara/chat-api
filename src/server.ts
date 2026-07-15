import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import authRoutes from './routes/authRoutes.js';
import Message from './models/Message.js';
import Room from './models/Room.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI as string)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB error:', err));

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Real-Time Chat API',
            version: '1.0.0',
            description: `WebSocket-based real-time chat API built with Socket.io, Node.js, TypeScript and MongoDB.

## How to use WebSockets

1. Register and login to get a JWT token
2. Connect to the WebSocket server with your token:
\`\`\`javascript
const socket = io('https://chat-api-udxb.onrender.com', {
  auth: { token: 'your-jwt-token' }
});
\`\`\`
3. Join a room:
\`\`\`javascript
socket.emit('join_room', 'general');
\`\`\`
4. Send a message:
\`\`\`javascript
socket.emit('send_message', { roomName: 'general', content: 'Hello!' });
\`\`\`
5. Listen for messages:
\`\`\`javascript
socket.on('new_message', (msg) => console.log(msg));
\`\`\`

## WebSocket Events

| Direction | Event | Payload |
|---|---|---|
| Client → Server | join_room | roomName: string |
| Client → Server | send_message | { roomName, content } |
| Client → Server | leave_room | roomName: string |
| Server → Client | room_history | { room, messages[] } |
| Server → Client | new_message | { id, content, sender, room, createdAt } |
| Server → Client | user_joined | { username, room } |
| Server → Client | user_left | { username, room } |
| Server → Client | error | { message } |
`,
        },
        servers: [
            {
                url: 'https://chat-api-udxb.onrender.com',
                description: 'Production server',
            },
            {
                url: 'http://localhost:3003',
                description: 'Local server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/', (req, res) => {
    res.redirect('/docs');
});

app.use('/api/auth', authRoutes);

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.username}`);

    socket.on('join_room', async (roomName: string) => {
        try {
            let room = await Room.findOne({ name: roomName });
            if (!room) {
                room = await Room.create({
                    name: roomName,
                    description: `${roomName} chat room`,
                    createdBy: socket.data.userId,
                    members: [socket.data.userId]
                });
            } else {
                if (!room.members.includes(socket.data.userId)) {
                    room.members.push(socket.data.userId);
                    await room.save();
                }
            }

            socket.join(roomName);

            const history = await Message.find({ room: room._id })
                .populate('sender', 'username')
                .sort({ createdAt: -1 })
                .limit(50)
                .sort({ createdAt: 1 });

            socket.emit('room_history', {
                room: roomName,
                messages: history.map(m => ({
                    id: m._id,
                    content: m.content,
                    sender: (m.sender as any).username,
                    createdAt: m.createdAt
                }))
            });

            socket.to(roomName).emit('user_joined', {
                username: socket.data.username,
                room: roomName
            });

            console.log(`${socket.data.username} joined room: ${roomName}`);
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('send_message', async ({ roomName, content }: { roomName: string; content: string }) => {
        try {
            const room = await Room.findOne({ name: roomName });
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            const message = await Message.create({
                content,
                sender: socket.data.userId,
                room: room._id
            });

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username');

            const messageData = {
                id: message._id,
                content: message.content,
                sender: (populatedMessage?.sender as any).username,
                room: roomName,
                createdAt: message.createdAt
            };

            io.to(roomName).emit('new_message', messageData);
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('leave_room', (roomName: string) => {
        socket.leave(roomName);
        socket.to(roomName).emit('user_left', {
            username: socket.data.username,
            room: roomName
        });
        console.log(`${socket.data.username} left room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.data.username}`);
    });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, () => {
    console.log(`Chat API running on port ${PORT}`);
    console.log(`Docs at http://localhost:${PORT}/docs`);
});
