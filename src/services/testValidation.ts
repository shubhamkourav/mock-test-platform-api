import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { Exam } from '../models/Exam';
import { Section } from '../models/Section';
import { ApiError } from '../utils/apiError';

export async function validateTestRelationships(input: { examId: string; sectionId?: string; sections?: Array<{ sectionId: string }> }) {
  const exam = await Exam.findOne({ _id: input.examId, isActive: true }).lean();
  if (!exam) throw new ApiError(400, 'Exam is invalid or inactive', 'INVALID_EXAM');
  const sectionIds = new Set<string>();
  if (input.sectionId) sectionIds.add(String(input.sectionId));
  for (const section of input.sections ?? []) sectionIds.add(String(section.sectionId));
  if (sectionIds.size) {
    const sections = await Section.find({ _id: { $in: [...sectionIds] }, examId: input.examId, isActive: true }).lean();
    if (sections.length !== sectionIds.size) throw new ApiError(400, 'One or more sections do not belong to the selected exam', 'INVALID_SECTION_RELATIONSHIP');
  }
}

export async function validateTestForPublish(test: any) {
  if (!test.durationMinutes || test.durationMinutes <= 0) throw new ApiError(409, 'Test duration must be positive', 'INVALID_TEST_DURATION');
  if (!test.totalQuestions || test.totalQuestions <= 0) throw new ApiError(409, 'Test question count must be positive', 'INVALID_TEST_QUESTIONS');
  if (test.totalMarks < 0) throw new ApiError(409, 'Test marks cannot be negative', 'INVALID_TEST_MARKS');
  if (!Array.isArray(test.sections) || test.sections.length === 0) throw new ApiError(409, 'Test sections are required', 'INVALID_TEST_SECTION_CONFIGURATION');

  await validateTestRelationships({ examId: test.examId.toString(), sectionId: test.sectionId?.toString(), sections: test.sections.map((section: any) => ({ sectionId: section.sectionId.toString() })) });

  const configuredIds = new Set(test.sections.map((section: any) => section.sectionId.toString()));
  const configuredQuestionCount = test.sections.reduce((sum: number, section: any) => sum + section.questionCount, 0);
  const configuredMarks = test.sections.reduce((sum: number, section: any) => sum + section.marks, 0);
  if (configuredQuestionCount !== test.totalQuestions) throw new ApiError(409, 'Configured section question counts do not match test total', 'INVALID_TEST_SECTION_CONFIGURATION');
  if (Math.abs(configuredMarks - test.totalMarks) > 0.000001) throw new ApiError(409, 'Configured section marks do not match test total', 'INVALID_TEST_SECTION_CONFIGURATION');
  if (test.sections.some((section: any) => section.durationMinutes <= 0 || section.questionCount <= 0 || section.marks < 0)) throw new ApiError(409, 'Test section configuration is invalid', 'INVALID_TEST_SECTION_CONFIGURATION');

  const mappings = await TestQuestion.find({ testId: test._id ?? test.id }).lean();
  if (!mappings.length || mappings.length !== test.totalQuestions) throw new ApiError(409, 'Test question count does not match configuration', 'INVALID_TEST_QUESTIONS');
  const orders = mappings.map(item => item.order);
  if (new Set(orders).size !== orders.length || orders.some(order => order < 1)) throw new ApiError(409, 'Test question ordering is invalid', 'INVALID_TEST_ORDER');

  const questions = await Question.find({ _id: { $in: mappings.map(item => item.questionId) }, isActive: true }).lean();
  if (questions.length !== mappings.length) throw new ApiError(409, 'Test contains missing or inactive questions', 'INVALID_TEST_QUESTIONS');
  const questionMap = new Map(questions.map(question => [question._id.toString(), question]));
  const questionSectionIds = new Set(questions.map(question => question.sectionId.toString()));
  const sections = await Section.find({ _id: { $in: [...questionSectionIds] }, examId: test.examId, isActive: true }).lean();
  if (sections.length !== questionSectionIds.size) throw new ApiError(409, 'Test contains questions from invalid sections', 'INVALID_QUESTION_RELATIONSHIP');

  let totalMarks = 0;
  const mappedCounts = new Map<string, number>();
  const mappedMarks = new Map<string, number>();
  for (const mapping of mappings) {
    const question = questionMap.get(mapping.questionId.toString());
    if (!question) throw new ApiError(409, 'Test contains an invalid question', 'INVALID_TEST_QUESTIONS');
    const mappingSectionId = (mapping.sectionId?.toString() ?? question.sectionId.toString());
    if (mappingSectionId !== question.sectionId.toString()) throw new ApiError(409, 'Test question section does not match question section', 'INVALID_TEST_QUESTION_RELATIONSHIP');
    if (!configuredIds.has(mappingSectionId)) throw new ApiError(409, 'Test question section is not configured', 'INVALID_TEST_SECTION_CONFIGURATION');
    const marks = mapping.marks ?? question.defaultMarks;
    if (marks < 0) throw new ApiError(409, 'Test question marks cannot be negative', 'INVALID_TEST_MARKS');
    totalMarks += marks;
    mappedCounts.set(mappingSectionId, (mappedCounts.get(mappingSectionId) ?? 0) + 1);
    mappedMarks.set(mappingSectionId, (mappedMarks.get(mappingSectionId) ?? 0) + marks);
  }
  if (Math.abs(totalMarks - test.totalMarks) > 0.000001) throw new ApiError(409, 'Test marks do not match mapped question marks', 'INVALID_TEST_MARKS');

  for (const configured of test.sections) {
    const sectionId = configured.sectionId.toString();
    if ((mappedCounts.get(sectionId) ?? 0) !== configured.questionCount || Math.abs((mappedMarks.get(sectionId) ?? 0) - configured.marks) > 0.000001) {
      throw new ApiError(409, `Section ${sectionId} does not match mapped questions`, 'INVALID_TEST_SECTION_CONFIGURATION');
    }
  }
}
