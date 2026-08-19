import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { Section } from '../models/Section';
import { ApiError } from '../utils/apiError';
import { validateTestForPublish, validateTestRelationships } from './testValidation';

async function getDraftTest(id: string) {
  const test = await Test.findById(id);
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  return test;
}

export async function listTests(query: Record<string, unknown>, includeUnpublished = false) {
  const filter: Record<string, unknown> = includeUnpublished ? {} : { isPublished: true };
  if (query.examId) filter.examId = query.examId;
  if (query.type) filter.type = query.type;
  return Test.find(filter).sort({ createdAt: -1 }).lean();
}

export async function getTest(id: string, includeUnpublished = false) {
  const test = await Test.findOne({ _id: id, ...(includeUnpublished ? {} : { isPublished: true }) }).lean();
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  const questions = await TestQuestion.find({ testId: test._id }).populate({ path: 'questionId', select: 'questionText options subjectTag topic difficulty defaultMarks negativeMarks explanation sectionId isActive' }).sort({ order: 1 }).lean();
  return { ...test, questions };
}

export async function createTest(input: Record<string, any>, createdBy: string) {
  await validateTestRelationships(input);
  return Test.create({ ...input, isPublished: false, createdBy });
}

export async function updateTest(id: string, input: Record<string, any>) {
  const test = await getDraftTest(id);
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  await validateTestRelationships({ ...test.toObject(), ...input });
  const updated = await Test.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!updated) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  return updated;
}

export async function addQuestion(testId: string, input: { questionId: string; sectionId?: string; order: number; marks?: number }) {
  const test = await getDraftTest(testId);
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  const question = await Question.findOne({ _id: input.questionId, isActive: true }).lean();
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  const section = await Section.findOne({ _id: question.sectionId, examId: test.examId, isActive: true }).lean();
  if (!section) throw new ApiError(400, 'Question does not belong to the test exam', 'INVALID_QUESTION_RELATIONSHIP');
  if (input.sectionId && String(input.sectionId) !== String(question.sectionId)) throw new ApiError(400, 'Test question section does not match question section', 'INVALID_TEST_QUESTION_RELATIONSHIP');
  const duplicate = await TestQuestion.findOne({ testId, questionId: input.questionId }).lean();
  if (duplicate) throw new ApiError(409, 'Question is already in the test', 'DUPLICATE_TEST_QUESTION');
  return TestQuestion.create({ testId, questionId: question._id, sectionId: question.sectionId, order: input.order, marks: input.marks ?? question.defaultMarks });
}

export async function updateQuestionMapping(testId: string, questionId: string, input: { sectionId?: string; order?: number; marks?: number }) {
  const test = await getDraftTest(testId);
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  const mapping = await TestQuestion.findOne({ testId, questionId });
  if (!mapping) throw new ApiError(404, 'Test question not found', 'TEST_QUESTION_NOT_FOUND');
  const question = await Question.findById(questionId).lean();
  if (!question || !question.isActive) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  const sectionId = input.sectionId ?? mapping.sectionId ?? question.sectionId;
  const section = await Section.findOne({ _id: sectionId, examId: test.examId, isActive: true }).lean();
  if (!section || String(question.sectionId) !== String(section._id)) throw new ApiError(400, 'Test question section is invalid', 'INVALID_TEST_QUESTION_RELATIONSHIP');
  mapping.sectionId = section._id;
  if (input.order !== undefined) mapping.order = input.order;
  if (input.marks !== undefined) mapping.marks = input.marks;
  await mapping.save();
  return mapping;
}

export async function deleteQuestionMapping(testId: string, questionId: string) {
  const test = await getDraftTest(testId);
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  const mapping = await TestQuestion.findOneAndDelete({ testId, questionId });
  if (!mapping) throw new ApiError(404, 'Test question not found', 'TEST_QUESTION_NOT_FOUND');
  return mapping;
}

export async function reorderQuestions(testId: string, items: Array<{ questionId: string; order: number }>) {
  const test = await getDraftTest(testId);
  if (test.isPublished) throw new ApiError(409, 'Published tests cannot be modified', 'TEST_ALREADY_PUBLISHED');
  const existing = await TestQuestion.find({ testId }).lean();
  if (items.length !== existing.length || new Set(items.map(item => item.questionId)).size !== items.length) {
    throw new ApiError(400, 'Reorder payload must contain every test question exactly once', 'INVALID_REORDER');
  }
  const existingIds = new Set(existing.map(item => item.questionId.toString()));
  if (items.some(item => !existingIds.has(item.questionId))) throw new ApiError(400, 'Reorder payload contains an unknown question', 'INVALID_REORDER');
  const orders = items.map(item => item.order);
  if (new Set(orders).size !== orders.length || orders.some(order => order < 1 || !Number.isInteger(order))) throw new ApiError(400, 'Question orders must be unique positive integers', 'INVALID_REORDER');
  await TestQuestion.bulkWrite(items.map(item => ({ updateOne: { filter: { testId, questionId: item.questionId }, update: { $set: { order: item.order } } } })));
  return TestQuestion.find({ testId }).sort({ order: 1 }).lean();
}

export async function publishTest(id: string) {
  const test = await getDraftTest(id);
  if (test.isPublished) return test;
  await validateTestForPublish(test);
  test.isPublished = true;
  await test.save();
  return test;
}

export async function unpublishTest(id: string) {
  const test = await Test.findById(id);
  if (!test) throw new ApiError(404, 'Test not found', 'TEST_NOT_FOUND');
  if (!test.isPublished) return test;
  test.isPublished = false;
  await test.save();
  return test;
}
