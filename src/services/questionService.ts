import { Question } from '../models/Question';
import { Section } from '../models/Section';
import { ApiError } from '../utils/apiError';

const allowedDifficulties = new Set(['easy', 'medium', 'hard']);

async function assertSection(sectionId: string, examId?: string) {
  const section = await Section.findOne({ _id: sectionId, isActive: true }).lean();
  if (!section) throw new ApiError(400, 'Section is invalid or inactive', 'INVALID_SECTION');
  if (examId && String(section.examId) !== String(examId)) throw new ApiError(400, 'Section does not belong to the selected exam', 'INVALID_SECTION_RELATIONSHIP');
  return section;
}

function assertOptions(options: Array<{ key: string; text: string }>, correctOptions: string[]) {
  const keys = options.map(option => option.key);
  if (new Set(keys).size !== keys.length) throw new ApiError(400, 'Question option keys must be unique', 'INVALID_QUESTION_OPTIONS');
  if (correctOptions.some(key => !keys.includes(key))) throw new ApiError(400, 'Correct answers must reference valid option keys', 'INVALID_QUESTION_OPTIONS');
}

export async function listQuestions(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page ?? 1) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 100);
  const filter: Record<string, unknown> = {};
  if (query.sectionId) filter.sectionId = query.sectionId;
  if (query.subjectTag) filter.subjectTag = query.subjectTag;
  if (query.subject) filter.subjectTag = query.subject;
  if (query.topic) filter.topic = query.topic;
  if (query.difficulty) {
    if (!allowedDifficulties.has(String(query.difficulty))) throw new ApiError(400, 'Invalid difficulty', 'INVALID_DIFFICULTY');
    filter.difficulty = query.difficulty;
  }
  if (query.active !== undefined) {
    const value = String(query.active).toLowerCase();
    if (!['true', 'false'].includes(value)) throw new ApiError(400, 'active must be true or false', 'INVALID_ACTIVE_FILTER');
    filter.isActive = value === 'true';
  } else filter.isActive = true;
  if (query.examId || query.exam) {
    const sections = await Section.find({ examId: String(query.examId ?? query.exam) }).select('_id').lean();
    if (!sections.length) return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
    filter.sectionId = { $in: sections.map(section => section._id) };
  }
  const [items, total] = await Promise.all([
    Question.find(filter).select('-correctOptions').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getQuestion(id: string, includeCorrectOptions = false) {
  const query = Question.findOne({ _id: id, isActive: true });
  if (!includeCorrectOptions) query.select('-correctOptions');
  const question = await query.lean();
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  return question;
}

export async function createQuestion(input: Record<string, any>) {
  const section = await assertSection(input.sectionId, input.examId);
  assertOptions(input.options, input.correctOptions);
  const { examId: _examId, ...questionInput } = input;
  return Question.create({ ...questionInput, sectionId: section._id });
}

export async function updateQuestion(id: string, input: Record<string, any>) {
  const current = await Question.findById(id);
  if (!current) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  const section = await assertSection(String(input.sectionId ?? current.sectionId), input.examId);
  const options = input.options ?? current.options;
  const correctOptions = input.correctOptions ?? current.correctOptions;
  assertOptions(options, correctOptions);
  const { examId: _examId, ...questionInput } = input;
  const updated = await Question.findByIdAndUpdate(id, { ...questionInput, sectionId: section._id }, { new: true, runValidators: true });
  if (!updated) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  return updated;
}

export async function deactivateQuestion(id: string) {
  const question = await Question.findByIdAndUpdate(id, { isActive: false }, { new: true, runValidators: true });
  if (!question) throw new ApiError(404, 'Question not found', 'QUESTION_NOT_FOUND');
  return question;
}
