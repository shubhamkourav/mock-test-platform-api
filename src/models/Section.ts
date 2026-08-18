import mongoose, { Schema } from 'mongoose';

const sectionSchema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  stage: { type: String, default: 'prelims', index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  subjectTag: { type: String, required: true, index: true },
  questionCount: { type: Number, required: true, min: 1 },
  timeMinutes: { type: Number, required: true, min: 1 },
  maxMarks: { type: Number, required: true, min: 0 },
  negativeMarking: { type: Number, default: 0, min: 0 },
  order: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

sectionSchema.index({ examId: 1, order: 1 });
export const Section = mongoose.model('Section', sectionSchema);
