import mongoose, { Schema } from 'mongoose';

const snapshotOptionSchema = new Schema({ key: String, text: String }, { _id: false });

const schema = new Schema({
  attemptId: { type: Schema.Types.ObjectId, ref: 'Attempt', required: true, index: true },
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  selectedOptions: { type: [String], default: [] },
  isCorrect: { type: Boolean, default: false },
  isAttempted: { type: Boolean, default: false },
  markedForReview: { type: Boolean, default: false },
  timeSpentSeconds: { type: Number, default: 0 },
  marksObtained: { type: Number, default: 0 },
  questionSnapshot: {
    questionText: String,
    options: { type: [snapshotOptionSchema], default: [] },
    correctOptions: { type: [String], default: [] },
    marks: Number,
    negativeMarks: Number,
    topic: String,
    subjectTag: String,
    explanation: String,
  },
}, { timestamps: true });

schema.index({ attemptId: 1, questionId: 1 }, { unique: true });
export const AttemptAnswer = mongoose.model('AttemptAnswer', schema);
