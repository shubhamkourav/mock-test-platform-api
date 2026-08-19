import { z } from 'zod';
import { objectId } from './common';

const testSection = z.object({
  sectionId: objectId,
  questionCount: z.number().int().positive(),
  marks: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
});

export const testSchema = z.object({
  examId: objectId,
  stage: z.string().min(1).max(50).default('prelims'),
  title: z.string().min(2).max(200),
  type: z.enum(['full_mock', 'sectional', 'topic_wise']),
  sectionId: objectId.optional(),
  totalQuestions: z.number().int().positive(),
  totalMarks: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  sections: z.array(testSection).min(1),
  settings: z.object({ shuffleQuestions: z.boolean().optional(), shuffleOptions: z.boolean().optional(), allowResume: z.boolean().optional() }).optional(),
});

export const addTestQuestionSchema = z.object({ questionId: objectId, sectionId: objectId.optional(), order: z.number().int().positive(), marks: z.number().nonnegative().optional() });
export const updateTestQuestionSchema = z.object({ sectionId: objectId.optional(), order: z.number().int().positive().optional(), marks: z.number().nonnegative().optional() }).refine(value => Object.keys(value).length > 0, 'At least one field is required');
export const reorderTestQuestionsSchema = z.object({ items: z.array(z.object({ questionId: objectId, order: z.number().int().positive() })).min(1) });
