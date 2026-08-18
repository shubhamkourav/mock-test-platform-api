import { Request, Response } from 'express';
import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { Section } from '../models/Section';
import { ok } from '../utils/response';
import { ApiError } from '../utils/apiError';
import { validateTestForPublish, validateTestRelationships } from '../services/testValidation';

export async function listTests(req: Request, res: Response) {
  const filter: Record<string, unknown> = { isPublished: true };
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.type) filter.type = req.query.type;
  return ok(res, await Test.find(filter).sort({ createdAt: -1 }));
}
export async function getTest(req: Request, res: Response) {
  const test = await Test.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  const questions = await TestQuestion.find({ testId: test._id }).populate({ path: 'questionId', select: 'questionText options subjectTag topic difficulty defaultMarks negativeMarks' }).sort({ order: 1 }).lean();
  return ok(res, { ...test, questions });
}
export async function createTest(req: Request, res: Response) {
  await validateTestRelationships(req.body);
  const test = await Test.create({ ...req.body, isPublished: false, createdBy: req.user!.id });
  return ok(res, test, 'Test created', 201);
}
export async function addQuestion(req: Request, res: Response) {
  const test = await Test.findById(req.params.id);
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  const question = await Question.findOne({ _id: req.body.questionId, isActive: true }).lean();
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  const section = await Section.findOne({ _id: question.sectionId, examId: test.examId, isActive: true }).lean();
  if (!section) throw new ApiError(400, 'Question does not belong to the test exam', 'INVALID_QUESTION_RELATIONSHIP');
  if (req.body.sectionId && req.body.sectionId !== question.sectionId.toString()) throw new ApiError(400, 'Test question section does not match question section', 'INVALID_TEST_QUESTION_RELATIONSHIP');
  return ok(res, await TestQuestion.create({ testId: test.id, questionId: question._id, sectionId: question.sectionId, order: req.body.order, marks: req.body.marks ?? question.defaultMarks }), 'Question added', 201);
}
export async function publishTest(req: Request, res: Response) {
  const test = await Test.findById(req.params.id);
  if (!test) throw new ApiError(404, 'Test not found', 'NOT_FOUND');
  if (test.isPublished) return ok(res, test, 'Test already published');
  await validateTestForPublish(test);
  test.isPublished = true;
  await test.save();
  return ok(res, test, 'Test published');
}
