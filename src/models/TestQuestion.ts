import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
  order: { type: Number, required: true, min: 1 },
  marks: { type: Number, required: true, min: 0 },
}, { timestamps: true });

schema.index({ testId: 1, questionId: 1 }, { unique: true });
schema.index({ testId: 1, order: 1 }, { unique: true });
export const TestQuestion = mongoose.model('TestQuestion', schema);
