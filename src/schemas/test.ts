import { z } from 'zod';

export const testSchema = z.object({
  examId: z.string(), stage: z.string().default('prelims'), title: z.string().min(2).max(200),
  type: z.enum(['full_mock', 'sectional', 'topic_wise']), sectionId: z.string().optional(),
  totalQuestions: z.number().int().positive(), totalMarks: z.number().nonnegative(), durationMinutes: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  sections: z.array(z.object({ sectionId: z.string(), questionCount: z.number().int().positive(), marks: z.number().nonnegative(), durationMinutes: z.number().int().positive() })).optional(),
  settings: z.object({ shuffleQuestions: z.boolean().optional(), shuffleOptions: z.boolean().optional(), allowResume: z.boolean().optional() }).optional(),
});

export const addTestQuestionSchema = z.object({ questionId: z.string(), sectionId: z.string().optional(), order: z.number().int().positive(), marks: z.number().nonnegative().optional() });
