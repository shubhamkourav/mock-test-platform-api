import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['student', 'admin']).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
