import { Request, Response } from 'express';
import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';
import { ok } from '../utils/response';
import { ApiError } from '../utils/apiError';

export async function listTests(req: Request, res: Response) {
  const filter: Record<string, unknown> = { isPublished: true };
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.type) filter.type = req.query.type;
  return ok(res, await Test.find(filter).sort({ createdAt: -1 }));
}

export async function getTest(req: Request, res: Response) {
  const test = await Test.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  const questions = await TestQuestion.find({ testId: test._id }).populate({
    path: 'questionId',
    select: 'questionText options subjectTag topic difficulty defaultMarks negativeMarks',
  }).sort({ order: 1 }).lean();
  return ok(res, { ...test, questions });
}

export async function createTest(req: Request, res: Response) {
  const test = await Test.create({ ...req.body, createdBy: req.user!.id });
  return ok(res, test, 'Test created', 201);
}

export async function addQuestion(req: Request, res: Response) {
  const test = await Test.findById(req.params.id);
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  return ok(res, await TestQuestion.create({ testId: test.id, ...req.body }), 'Question added', 201);
}

export async function publishTest(req: Request, res: Response) {
  const test = await Test.findByIdAndUpdate(req.params.id, { isPublished: true }, { new: true });
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  return ok(res, test, 'Test published');
}
