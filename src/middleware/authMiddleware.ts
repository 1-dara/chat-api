import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthRequest extends Request {
    userId?: string;
    username?: string;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, decoded: any) => {
        if (err) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        req.userId = decoded.userId;
        req.username = decoded.username;
        next();
    });
}