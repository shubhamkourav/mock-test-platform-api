import { Attempt } from '../models/Attempt';
import { AttemptAnswer } from '../models/AttemptAnswer';
import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { ApiError } from '../utils/apiError';
import { validateTestForPublish } from './testValidation';
import { scoreAnswer, calculateAttemptScore } from './scoringService';

function isExpired(attempt: { startTime: Date }, durationMinutes: number, now = new Date()) {
  return now.getTime() >= attempt.startTime.getTime() + durationMinutes * 60_000;
}

async function loadAttemptQuestions(testId: string) {
  return TestQuestion.find({ testId }).populate({ path: 'questionId', select: 'questionText options subjectTag topic difficulty defaultMarks negativeMarks explanation sectionId' }).sort({ order: 1 }).lean();
}

export async function createAttempt(testId: string, userId: string) {
  const test = await Test.findOne({ _id: testId, isPublished: true });
  if (!test) throw new ApiError(404, 'Published test not found', 'TEST_NOT_FOUND');
  await validateTestForPublish(test);
  const testQuestions = await TestQuestion.find({ testId: test._id }).lean();
  if (testQuestions.length !== test.totalQuestions || testQuestions.length === 0) throw new ApiError(409, 'Test configuration is invalid', 'INVALID_TEST_CONFIGURATION');

  const existing = await Attempt.findOne({ userId, testId: test._id, status: 'in_progress' });
  if (existing) {
    if (test.settings?.allowResume !== false && !isExpired(existing, test.durationMinutes)) {
      return { attempt: existing, questions: await loadAttemptQuestions(test.id), resumed: true };
    }
    if (isExpired(existing, test.durationMinutes)) {
      await submitAttemptDocument(existing.id, userId, true);
    } else {
      throw new ApiError(409, 'An active attempt already exists', 'ACTIVE_ATTEMPT_EXISTS');
    }
  }

  let attempt;
  try {
    attempt = await Attempt.create({ userId, testId: test._id });
  } catch (error: any) {
    if (error?.code === 11000) {
      const active = await Attempt.findOne({ userId, testId: test._id, status: 'in_progress' });
      if (active && test.settings?.allowResume !== false && !isExpired(active, test.durationMinutes)) return { attempt: active, questions: await loadAttemptQuestions(test.id), resumed: true };
    }
    throw error;
  }
  return { attempt, questions: await loadAttemptQuestions(test.id), resumed: false };
}

export async function getAttempt(id: string, userId: string) {
  const attempt = await Attempt.findOne({ _id: id, userId });
  if (!attempt) throw new ApiError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
  const answers = await AttemptAnswer.find({ attemptId: attempt.id }).select('questionId selectedOptions markedForReview timeSpentSeconds isAttempted').lean();
  return { attempt, answers };
}

export async function saveAnswer(attemptId: string, userId: string, input: { questionId: string; selectedOptions: string[]; markedForReview: boolean; timeSpentSeconds: number }) {
  const attempt = await Attempt.findOne({ _id: attemptId, userId, status: 'in_progress' });
  if (!attempt) throw new ApiError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
  const test = await Test.findById(attempt.testId).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  if (isExpired(attempt, test.durationMinutes)) {
    await submitAttemptDocument(attempt.id, userId, true);
    throw new ApiError(409, 'Attempt deadline has passed', 'ATTEMPT_EXPIRED');
  }
  const testQuestion = await TestQuestion.findOne({ testId: test._id, questionId: input.questionId }).lean();
  if (!testQuestion) throw new ApiError(400, 'Question does not belong to this test', 'QUESTION_NOT_IN_TEST');
  const question = await Question.findOne({ _id: input.questionId, isActive: true });
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  const validOptionKeys = new Set(question.options.map(option => option.key));
  const selectedOptions = [...new Set(input.selectedOptions)];
  if (selectedOptions.some(key => !validOptionKeys.has(key))) throw new ApiError(400, 'One or more selected options are invalid', 'INVALID_OPTIONS');
  const scoring = scoreAnswer(selectedOptions, question.correctOptions, testQuestion.marks, question.negativeMarks);
  return AttemptAnswer.findOneAndUpdate(
    { attemptId: attempt.id, questionId: question.id },
    { $set: { selectedOptions: scoring.selected, isAttempted: scoring.isAttempted, isCorrect: scoring.isCorrect, markedForReview: input.markedForReview, timeSpentSeconds: input.timeSpentSeconds, marksObtained: scoring.marksObtained, questionSnapshot: { questionText: question.questionText, options: question.options, correctOptions: question.correctOptions, marks: testQuestion.marks, negativeMarks: question.negativeMarks, topic: question.topic, subjectTag: question.subjectTag, explanation: question.explanation } } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function submitAttemptDocument(attemptId: string, userId: string, autoSubmitted: boolean) {
  const current = await Attempt.findOne({ _id: attemptId, userId, status: 'in_progress' });
  if (!current) return Attempt.findOne({ _id: attemptId, userId });
  const test = await Test.findById(current.testId).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  const calculated = await calculateAttemptScore(current.id, test._id.toString());
  const endTime = new Date();
  const timeTakenSeconds = Math.min(Math.max(0, Math.floor((endTime.getTime() - current.startTime.getTime()) / 1000)), test.durationMinutes * 60);
  const updated = await Attempt.findOneAndUpdate(
    { _id: current.id, userId, status: 'in_progress' },
    { $set: { endTime, totalScore: calculated.score, correctCount: calculated.correct, incorrectCount: calculated.incorrect, unattemptedCount: calculated.unattempted, timeTakenSeconds, sectionResults: calculated.sectionResults, status: autoSubmitted ? 'auto_submitted' : 'completed' } },
    { new: true },
  );
  return updated ?? Attempt.findOne({ _id: current.id, userId });
}

export async function submitAttempt(attemptId: string, userId: string) {
  const existing = await Attempt.findOne({ _id: attemptId, userId });
  if (!existing) throw new ApiError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
  if (existing.status !== 'in_progress') return existing;
  const test = await Test.findById(existing.testId).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  const attempt = await submitAttemptDocument(existing.id, userId, isExpired(existing, test.durationMinutes));
  if (!attempt) throw new ApiError(409, 'Unable to submit attempt', 'SUBMISSION_CONFLICT');
  return attempt;
}
