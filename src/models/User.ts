import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
  targetExamIds: [{ type: Schema.Types.ObjectId, ref: 'Exam' }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = mongoose.model('User', userSchema);
