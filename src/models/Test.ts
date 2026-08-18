import mongoose, { Schema } from 'mongoose';

const testSectionSchema = new Schema({
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true },
  questionCount: { type: Number, required: true, min: 1 },
  marks: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, required: true, min: 1 },
}, { _id: false });

const testSchema = new Schema({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  stage: { type: String, default: 'prelims' },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['full_mock', 'sectional', 'topic_wise'], required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
  totalQuestions: { type: Number, required: true, min: 1 },
  totalMarks: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, required: true, min: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
  sections: { type: [testSectionSchema], default: [] },
  settings: {
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    allowResume: { type: Boolean, default: true },
  },
  isPublished: { type: Boolean, default: false, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

testSchema.index({ examId: 1, isPublished: 1, type: 1 });
export const Test = mongoose.model('Test', testSchema);
