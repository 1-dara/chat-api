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
app.use('/api/auth', authRoutes);
import testRoutes from './routes/testRoutes.js';
app.use('/', testRoutes);


mongoose.connect(process.env.MONGODB_URI as string)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB error:', err));

app.get('/', (req, res) => {
    app.get('/', (req, res) => {
        res.redirect('/test');
    });

    res.json({
        message: 'Real-Time Chat API',
        version: '1.0.0',
        description: 'WebSocket-based chat API built with Socket.io and MongoDB',
        authentication: 'JWT — get token from /api/auth/login then pass as socket auth',
        rest_endpoints: {
            'POST /api/auth/register': 'Register a new user',
            'POST /api/auth/login': 'Login and get JWT token'
        },
        websocket_events: {
            client_emits: {
                join_room: 'roomName (string)',
                send_message: '{ roomName, content }',
                leave_room: 'roomName (string)'
            },
            server_emits: {
                room_history: 'Last 50 messages on join',
                new_message: 'New message broadcast to room',
                user_joined: 'User joined notification',
                user_left: 'User left notification',
                error: 'Error message'
            }
        },
        test_client: 'https://amritb.github.io/socketio-client-tool/',
        github: 'https://github.com/1-dara/chat-api'
    });
});

app.use('/api/auth', authRoutes);

// WebSocket connection handler
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

    // Join a chat room
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

            // Send last 50 messages as history
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

            // Notify others in the room
            socket.to(roomName).emit('user_joined', {
                username: socket.data.username,
                room: roomName
            });

            console.log(`${socket.data.username} joined room: ${roomName}`);
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    // Send a message
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

            // Broadcast to everyone in the room including sender
            io.to(roomName).emit('new_message', messageData);
        } catch (error: any) {
            socket.emit('error', { message: error.message });
        }
    });

    // Leave a room
    socket.on('leave_room', (roomName: string) => {
        socket.leave(roomName);
        socket.to(roomName).emit('user_left', {
            username: socket.data.username,
            room: roomName
        });
        console.log(`${socket.data.username} left room: ${roomName}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.data.username}`);
    });
});

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, () => {
    console.log(`Chat API running on port ${PORT}`);
});