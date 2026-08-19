import { Attempt } from '../models/Attempt';
import { AttemptAnswer } from '../models/AttemptAnswer';
import { Test } from '../models/Test';
import { ApiError } from '../utils/apiError';

function percentage(score: number, totalMarks: number) {
  return totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;
}

function accuracy(correct: number, incorrect: number) {
  const attempted = correct + incorrect;
  return attempted > 0 ? Number(((correct / attempted) * 100).toFixed(2)) : 0;
}

export async function getAttemptResult(attemptId: string, userId: string) {
  const attempt = await Attempt.findOne({ _id: attemptId, userId }).lean();
  if (!attempt) throw new ApiError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
  if (attempt.status === 'in_progress') throw new ApiError(400, 'Attempt is not submitted yet', 'NOT_SUBMITTED');

  const [test, answers] = await Promise.all([
    Test.findById(attempt.testId).select('title totalMarks durationMinutes').lean(),
    AttemptAnswer.find({ attemptId }).sort({ createdAt: 1 }).lean(),
  ]);
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');

  const topicMap = new Map<string, { attempted: number; correct: number; incorrect: number; score: number; timeSpentSeconds: number }>();
  for (const answer of answers) {
    const topic = answer.questionSnapshot?.topic ?? 'Unknown';
    const current = topicMap.get(topic) ?? { attempted: 0, correct: 0, incorrect: 0, score: 0, timeSpentSeconds: 0 };
    if (answer.isAttempted) current.attempted += 1;
    if (answer.isCorrect) current.correct += 1;
    if (answer.isAttempted && !answer.isCorrect) current.incorrect += 1;
    current.score += answer.marksObtained ?? 0;
    current.timeSpentSeconds += answer.timeSpentSeconds ?? 0;
    topicMap.set(topic, current);
  }

  const review = answers.map(answer => ({
    questionId: answer.questionId,
    questionText: answer.questionSnapshot?.questionText,
    options: answer.questionSnapshot?.options ?? [],
    selectedOptions: answer.selectedOptions ?? [],
    correctOptions: answer.questionSnapshot?.correctOptions ?? [],
    isAttempted: answer.isAttempted,
    isCorrect: answer.isCorrect,
    markedForReview: answer.markedForReview,
    marks: answer.questionSnapshot?.marks ?? 0,
    negativeMarks: answer.questionSnapshot?.negativeMarks ?? 0,
    marksObtained: answer.marksObtained ?? 0,
    timeSpentSeconds: answer.timeSpentSeconds ?? 0,
    topic: answer.questionSnapshot?.topic,
    subjectTag: answer.questionSnapshot?.subjectTag,
    explanation: undefined,
  }));

  return {
    attempt,
    score: attempt.totalScore,
    totalMarks: test.totalMarks,
    percentage: percentage(attempt.totalScore, test.totalMarks),
    accuracy: accuracy(attempt.correctCount, attempt.incorrectCount),
    correct: attempt.correctCount,
    incorrect: attempt.incorrectCount,
    unattempted: attempt.unattemptedCount,
    timeTaken: attempt.timeTakenSeconds,
    status: attempt.status,
    sections: attempt.sectionResults,
    topics: [...topicMap.entries()].map(([topic, value]) => ({ topic, ...value, accuracy: accuracy(value.correct, value.incorrect) })),
    review,
  };
}
