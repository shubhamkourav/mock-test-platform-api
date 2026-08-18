import { z } from 'zod';

const option = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
});

export const questionSchema = z.object({
  sectionId: z.string(),
  subjectTag: z.string().min(1),
  topic: z.string().min(1),
  questionText: z.string().min(1),
  options: z.array(option).min(2).max(10),
  correctOptions: z.array(z.string()).min(1),
  explanation: z.string().optional(),
  defaultMarks: z.number().nonnegative().default(1),
  negativeMarks: z.number().nonnegative().default(0),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  source: z.string().default('original'),
  language: z.string().default('en'),
  isActive: z.boolean().optional(),
});
