import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            res.status(400).json({ error: 'Email or username already taken' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashedPassword });

        res.status(201).json({
            id: user._id,
            username: user.username,
            email: user.email
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        res.json({ access_token: token, token_type: 'bearer', username: user.username });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}