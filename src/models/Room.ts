import mongoose, { Document, Schema } from 'mongoose';

export interface IRoom extends Document {
    name: string;
    description: string;
    createdBy: mongoose.Types.ObjectId;
    members: mongoose.Types.ObjectId[];
    createdAt: Date;
}

const RoomSchema = new Schema<IRoom>({
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

export default mongoose.model<IRoom>('Room', RoomSchema);