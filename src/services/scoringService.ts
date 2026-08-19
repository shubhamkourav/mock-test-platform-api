import { AttemptAnswer } from '../models/AttemptAnswer';
import { TestQuestion } from '../models/TestQuestion';

export function scoreAnswer(selectedOptions: string[], correctOptions: string[], marks: number, negativeMarks: number) {
  const selected = [...new Set(selectedOptions)].sort();
  const correct = [...new Set(correctOptions)].sort();
  const isAttempted = selected.length > 0;
  const isCorrect = isAttempted && selected.length === correct.length && selected.every((value, index) => value === correct[index]);
  return {
    selected,
    isAttempted,
    isCorrect,
    marksObtained: isCorrect ? marks : isAttempted ? -negativeMarks : 0,
  };
}

export async function calculateAttemptScore(attemptId: string, testId: string) {
  const [answers, testQuestions] = await Promise.all([
    AttemptAnswer.find({ attemptId }).lean(),
    TestQuestion.find({ testId }).lean(),
  ]);
  const questionIds = new Set(testQuestions.map(item => item.questionId.toString()));
  const validAnswers = answers.filter(answer => questionIds.has(answer.questionId.toString()));
  const attempted = validAnswers.filter(answer => answer.isAttempted).length;
  const correct = validAnswers.filter(answer => answer.isCorrect).length;
  const incorrect = validAnswers.filter(answer => answer.isAttempted && !answer.isCorrect).length;
  const unattempted = Math.max(testQuestions.length - attempted, 0);
  const score = validAnswers.reduce((sum, answer) => sum + (answer.marksObtained ?? 0), 0);

  const sectionIds = [...new Set(testQuestions.map(item => item.sectionId?.toString()).filter(Boolean))] as string[];
  const sectionResults = sectionIds.map(sectionId => {
    const sectionQuestions = testQuestions.filter(item => item.sectionId?.toString() === sectionId);
    const ids = new Set(sectionQuestions.map(item => item.questionId.toString()));
    const sectionAnswers = validAnswers.filter(answer => ids.has(answer.questionId.toString()));
    const sectionAttempted = sectionAnswers.filter(answer => answer.isAttempted).length;
    const sectionCorrect = sectionAnswers.filter(answer => answer.isCorrect).length;
    const sectionIncorrect = sectionAnswers.filter(answer => answer.isAttempted && !answer.isCorrect).length;
    return {
      sectionId,
      attempted: sectionAttempted,
      correct: sectionCorrect,
      incorrect: sectionIncorrect,
      unattempted: Math.max(sectionQuestions.length - sectionAttempted, 0),
      score: sectionAnswers.reduce((sum, answer) => sum + (answer.marksObtained ?? 0), 0),
      timeSpentSeconds: sectionAnswers.reduce((sum, answer) => sum + (answer.timeSpentSeconds ?? 0), 0),
    };
  });

  return { attempted, correct, incorrect, unattempted, score, sectionResults };
}
