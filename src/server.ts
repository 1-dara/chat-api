import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
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

app.get('/', (req, res) => {
    res.json({
        name: 'Real-Time Chat API',
        version: '1.0.0',
        status: 'running',
        description: 'WebSocket-based real-time chat API built with Socket.io, Node.js, TypeScript and MongoDB',
        github: 'https://github.com/1-dara/chat-api',
        rest_endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login'
        },
        websocket: {
            url: 'wss://chat-api-udxb.onrender.com',
            auth: 'Pass JWT token in socket handshake: { auth: { token } }',
            client_events: {
                join_room: 'string (room name)',
                send_message: '{ roomName: string, content: string }',
                leave_room: 'string (room name)'
            },
            server_events: {
                room_history: 'Last 50 messages on room join',
                new_message: 'New message broadcast to all room members',
                user_joined: 'Notification when user joins room',
                user_left: 'Notification when user leaves room',
                error: 'Error message'
            }
        }
    });
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
});