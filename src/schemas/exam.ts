import { z } from 'zod';
import { objectId } from './common';

export const examSchema = z.object({
  name: z.string().min(2).max(150),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().min(2).max(80),
  conductingBody: z.string().max(120).optional(),
  examPatternNotes: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export const sectionSchema = z.object({
  examId: objectId,
  stage: z.string().default('prelims'),
  name: z.string().min(2),
  slug: z.string().min(2),
  subjectTag: z.string().min(1),
  questionCount: z.number().int().positive(),
  timeMinutes: z.number().int().positive(),
  maxMarks: z.number().nonnegative(),
  negativeMarking: z.number().nonnegative().default(0),
  order: z.number().int().positive().default(1),
  isActive: z.boolean().optional(),
});
