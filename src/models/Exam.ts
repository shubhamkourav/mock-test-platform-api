import mongoose, { Schema } from 'mongoose';

const examSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  category: { type: String, required: true, index: true },
  conductingBody: String,
  examPatternNotes: String,
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

examSchema.index({ category: 1, isActive: 1 });
export const Exam = mongoose.model('Exam', examSchema);
