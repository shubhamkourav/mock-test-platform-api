import { Request, Response } from 'express';
import { Question } from '../models/Question';
import { Section } from '../models/Section';
import { ApiError } from '../utils/apiError';
import { ok } from '../utils/response';

async function assertSection(sectionId: string) { const section = await Section.findOne({ _id: sectionId, isActive: true }).lean(); if (!section) throw new ApiError(400, 'Section is invalid or inactive', 'INVALID_SECTION'); }
export async function listQuestions(req: Request, res: Response) {
  const page = Math.max(Number(req.query.page ?? 1), 1); const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100); const filter: Record<string, unknown> = { isActive: true };
  for (const key of ['sectionId', 'subjectTag', 'topic', 'difficulty']) if (req.query[key]) filter[key] = req.query[key];
  const [items, total] = await Promise.all([Question.find(filter).select('-correctOptions').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Question.countDocuments(filter)]); return ok(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function getQuestion(req: Request, res: Response) { const question = await Question.findOne({ _id: req.params.id, isActive: true }).select('-correctOptions'); if (!question) return res.status(404).json({ success: false, message: 'Question not found' }); return ok(res, question); }
export async function createQuestion(req: Request, res: Response) {
  await assertSection(req.body.sectionId); const optionKeys: string[] = req.body.options.map((option: { key: string }) => option.key); const correctOptions: string[] = req.body.correctOptions;
  if (new Set(optionKeys).size !== optionKeys.length || correctOptions.some((key: string) => !optionKeys.includes(key))) throw new ApiError(400, 'Question options and correct answers are inconsistent', 'INVALID_QUESTION_OPTIONS'); return ok(res, await Question.create(req.body), 'Question created', 201);
}
export async function updateQuestion(req: Request, res: Response) {
  if (req.body.sectionId) await assertSection(req.body.sectionId);
  if (req.body.options || req.body.correctOptions) { const current = await Question.findById(req.params.id).lean(); if (!current) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND'); const options = req.body.options ?? current.options; const correctOptions: string[] = req.body.correctOptions ?? current.correctOptions; const optionKeys: string[] = options.map((option: { key: string }) => option.key); if (new Set(optionKeys).size !== optionKeys.length || correctOptions.some((key: string) => !optionKeys.includes(key))) throw new ApiError(400, 'Question options and correct answers are inconsistent', 'INVALID_QUESTION_OPTIONS'); }
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!question) return res.status(404).json({ success: false, message: 'Question not found' }); return ok(res, question, 'Question updated');
}
