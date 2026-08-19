import { Exam } from '../models/Exam';
import { Section } from '../models/Section';
import { Question } from '../models/Question';
import { Test } from '../models/Test';
import { ApiError } from '../utils/apiError';

export async function listExams(includeInactive = false) {
  const filter = includeInactive ? {} : { isActive: true };
  return Exam.find(filter).sort({ name: 1 }).lean();
}

export async function getExam(id: string, includeInactive = false) {
  const exam = await Exam.findOne({ _id: id, ...(includeInactive ? {} : { isActive: true }) }).lean();
  if (!exam) throw new ApiError(404, 'Exam not found', 'EXAM_NOT_FOUND');
  return exam;
}

export async function createExam(input: Record<string, unknown>) {
  return Exam.create(input);
}

export async function updateExam(id: string, input: Record<string, unknown>) {
  const exam = await Exam.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!exam) throw new ApiError(404, 'Exam not found', 'EXAM_NOT_FOUND');
  return exam;
}

export async function listSections(examId: string, includeInactive = false) {
  await getExam(examId, includeInactive);
  return Section.find({ examId, ...(includeInactive ? {} : { isActive: true }) }).sort({ order: 1, name: 1 }).lean();
}

export async function createSection(examId: string, input: Record<string, unknown>) {
  await getExam(examId);
  return Section.create({ ...input, examId });
}

export async function updateSection(id: string, input: Record<string, unknown>) {
  const section = await Section.findById(id);
  if (!section) throw new ApiError(404, 'Section not found', 'SECTION_NOT_FOUND');
  if (input.examId && String(input.examId) !== String(section.examId)) {
    throw new ApiError(400, 'Section cannot be moved to another exam', 'INVALID_SECTION_RELATIONSHIP');
  }
  const updated = await Section.findByIdAndUpdate(id, { ...input, examId: section.examId }, { new: true, runValidators: true });
  if (!updated) throw new ApiError(404, 'Section not found', 'SECTION_NOT_FOUND');
  return updated;
}

export async function deactivateSection(id: string) {
  const section = await Section.findById(id);
  if (!section) throw new ApiError(404, 'Section not found', 'SECTION_NOT_FOUND');
  const activeQuestions = await Question.countDocuments({ sectionId: id, isActive: true });
  if (activeQuestions > 0) {
    throw new ApiError(409, 'Deactivate questions before deactivating the section', 'ACTIVE_QUESTIONS_EXIST');
  }
  const activePublishedTests = await Test.countDocuments({ isPublished: true, 'sections.sectionId': section._id });
  if (activePublishedTests > 0) {
    throw new ApiError(409, 'Section is used by a published test', 'PUBLISHED_TESTS_EXIST');
  }
  section.isActive = false;
  await section.save();
  return section;
}
