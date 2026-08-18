import { z } from 'zod';

export const createAttemptSchema = z.object({
  testId: z.string(),
});

export const answerSchema = z.object({
  questionId: z.string(),
  selectedOptions: z.array(z.string()).default([]),
  markedForReview: z.boolean().default(false),
  timeSpentSeconds: z.number().int().nonnegative().default(0),
});
