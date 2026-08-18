import { Request, Response } from 'express';
import { Attempt } from '../models/Attempt';
import { AttemptAnswer } from '../models/AttemptAnswer';
import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { ApiError } from '../utils/apiError';
import { ok } from '../utils/response';

export async function createAttempt(req: Request, res: Response) {
  const test = await Test.findOne({ _id: req.body.testId, isPublished: true });
  if (!test) throw new ApiError(404, 'Published test not found', 'TEST_NOT_FOUND');

  const attempt = await Attempt.create({
    userId: req.user!.id,
    testId: test.id,
  });

  const questions = await TestQuestion.find({ testId: test.id })
    .populate({ path: 'questionId', select: 'questionText options subjectTag topic difficulty defaultMarks negativeMarks' })
    .sort({ order: 1 })
    .lean();

  return ok(res, { attempt, questions }, 'Attempt started', 201);
}

export async function getAttempt(req: Request, res: Response) {
  const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!attempt) throw new ApiError(404, 'Attempt not found', 'NOT_FOUND');

  const answers = await AttemptAnswer.find({ attemptId: attempt.id }).select(
    'questionId selectedOptions markedForReview timeSpentSeconds isAttempted',
  );
  return ok(res, { attempt, answers });
}

export async function saveAnswer(req: Request, res: Response) {
  const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user!.id, status: 'in_progress' });
  if (!attempt) throw new ApiError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');

  const question = await Question.findOne({ _id: req.body.questionId, isActive: true });
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');

  const selected = [...new Set(req.body.selectedOptions as string[])].sort();
  const correct = [...question.correctOptions].sort();
  const isAttempted = selected.length > 0;
  const isCorrect = isAttempted && selected.length === correct.length && selected.every((v, i) => v === correct[i]);
  const marks = isCorrect ? question.defaultMarks : (isAttempted ? -question.negativeMarks : 0);

  const answer = await AttemptAnswer.findOneAndUpdate(
    { attemptId: attempt.id, questionId: question.id },
    {
      $set: {
        selectedOptions: selected,
        isAttempted,
        isCorrect,
        markedForReview: req.body.markedForReview,
        timeSpentSeconds: req.body.timeSpentSeconds,
        marksObtained: marks,
        questionSnapshot: {
          questionText: question.questionText,
          options: question.options,
          correctOptions: question.correctOptions,
          marks: question.defaultMarks,
          negativeMarks: question.negativeMarks,
          topic: question.topic,
          subjectTag: question.subjectTag,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return ok(res, answer, 'Answer saved');
}

export async function submitAttempt(req: Request, res: Response) {
  const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user!.id, status: 'in_progress' });
  if (!attempt) throw new ApiError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');

  const test = await Test.findById(attempt.testId);
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');

  const answers = await AttemptAnswer.find({ attemptId: attempt.id });
  const testQuestions = await TestQuestion.find({ testId: test.id }).lean();

  const attempted = answers.filter(a => a.isAttempted).length;
  const correct = answers.filter(a => a.isCorrect).length;
  const incorrect = answers.filter(a => a.isAttempted && !a.isCorrect).length;
  const unattempted = Math.max(testQuestions.length - attempted, 0);
  const score = answers.reduce((sum, a) => sum + a.marksObtained, 0);
  const endTime = new Date();
  const timeTakenSeconds = Math.max(0, Math.floor((endTime.getTime() - attempt.startTime.getTime()) / 1000));

  attempt.endTime = endTime;
  attempt.totalScore = score;
  attempt.correctCount = correct;
  attempt.incorrectCount = incorrect;
  attempt.unattemptedCount = unattempted;
  attempt.timeTakenSeconds = timeTakenSeconds;
  attempt.status = req.body.autoSubmitted ? 'auto_submitted' : 'completed';
  await attempt.save();

  return ok(res, attempt, 'Attempt submitted');
}

export async function result(req: Request, res: Response) {
  const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!attempt) throw new ApiError(404, 'Attempt not found', 'NOT_FOUND');
  if (attempt.status === 'in_progress') throw new ApiError(400, 'Attempt is not submitted yet', 'NOT_SUBMITTED');

  const answers = await AttemptAnswer.find({ attemptId: attempt.id }).lean();
  const topicMap = new Map<string, { attempted: number; correct: number; score: number }>();
  for (const answer of answers) {
    const topic = answer.questionSnapshot?.topic ?? 'Unknown';
    const current = topicMap.get(topic) ?? { attempted: 0, correct: 0, score: 0 };
    if (answer.isAttempted) current.attempted += 1;
    if (answer.isCorrect) current.correct += 1;
    current.score += answer.marksObtained;
    topicMap.set(topic, current);
  }

  return ok(res, {
    attempt,
    accuracy: attempt.correctCount + attempt.incorrectCount
      ? Number(((attempt.correctCount / (attempt.correctCount + attempt.incorrectCount)) * 100).toFixed(2))
      : 0,
    topics: [...topicMap.entries()].map(([topic, value]) => ({
      topic,
      ...value,
      accuracy: value.attempted ? Number(((value.correct / value.attempted) * 100).toFixed(2)) : 0,
    })),
    answers,
  });
}
