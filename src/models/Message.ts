import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    content: string;
    sender: mongoose.Types.ObjectId;
    room: mongoose.Types.ObjectId;
    createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
    content: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);