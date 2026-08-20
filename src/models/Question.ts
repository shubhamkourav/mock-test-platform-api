import mongoose, { Schema } from 'mongoose';

const optionSchema = new Schema({
  key: { type: String, required: true },
  text: { type: String, required: true },
}, { _id: false });

const questionSchema = new Schema({
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  subjectTag: { type: String, required: true, index: true },
  topic: { type: String, required: true, index: true },
  questionText: { type: String, required: true },
  options: { type: [optionSchema], default: [] },
  correctOptions: { type: [String], required: true },
  selectionMode: { type: String, enum: ['single', 'multiple'], default: 'single', required: true },
  explanation: String,
  defaultMarks: { type: Number, default: 1, min: 0 },
  negativeMarks: { type: Number, default: 0, min: 0 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium', index: true },
  source: { type: String, default: 'original' },
  language: { type: String, default: 'en' },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

questionSchema.index({ subjectTag: 1, topic: 1, difficulty: 1, isActive: 1 });
questionSchema.index({ sectionId: 1, isActive: 1 });
export const Question = mongoose.model('Question', questionSchema);
