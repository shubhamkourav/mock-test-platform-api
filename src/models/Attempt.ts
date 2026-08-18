import mongoose, { Schema } from 'mongoose';

const sectionResultSchema = new Schema({
  sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
  attempted: Number,
  correct: Number,
  incorrect: Number,
  unattempted: Number,
  score: Number,
  timeSpentSeconds: Number,
}, { _id: false });

const attemptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  totalScore: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  unattemptedCount: { type: Number, default: 0 },
  timeTakenSeconds: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'completed', 'auto_submitted'], default: 'in_progress', index: true },
  sectionResults: { type: [sectionResultSchema], default: [] },
}, { timestamps: true });

attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, testId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'in_progress' } });
export const Attempt = mongoose.model('Attempt', attemptSchema);
