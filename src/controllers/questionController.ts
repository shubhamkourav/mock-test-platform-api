import { Request, Response } from 'express';
import { Question } from '../models/Question';
import { ok } from '../utils/response';

export async function listQuestions(req: Request, res: Response) {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
  const filter: Record<string, unknown> = { isActive: true };
  for (const key of ['sectionId', 'subjectTag', 'topic', 'difficulty']) {
    if (req.query[key]) filter[key] = req.query[key];
  }
  const [items, total] = await Promise.all([
    Question.find(filter).select('-correctOptions').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Question.countDocuments(filter),
  ]);
  return ok(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getQuestion(req: Request, res: Response) {
  const question = await Question.findOne({ _id: req.params.id, isActive: true }).select('-correctOptions');
  if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
  return ok(res, question);
}

export async function createQuestion(req: Request, res: Response) {
  return ok(res, await Question.create(req.body), 'Question created', 201);
}

export async function updateQuestion(req: Request, res: Response) {
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!question) return res.status(404).json({ success: false, message: 'Question not found' });
  return ok(res, question, 'Question updated');
}
