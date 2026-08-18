import { TestQuestion } from '../models/TestQuestion';
import { Question } from '../models/Question';
import { Exam } from '../models/Exam';
import { Section } from '../models/Section';
import { ApiError } from '../utils/apiError';

export async function validateTestRelationships(input: { examId: string; sectionId?: string; sections?: Array<{ sectionId: string }> }) {
  const exam = await Exam.findById(input.examId).lean();
  if (!exam || !exam.isActive) throw new ApiError(400, 'Exam is invalid or inactive', 'INVALID_EXAM');
  const sectionIds = new Set<string>();
  if (input.sectionId) sectionIds.add(input.sectionId);
  for (const section of input.sections ?? []) sectionIds.add(section.sectionId);
  if (sectionIds.size) {
    const sections = await Section.find({ _id: { $in: [...sectionIds] }, examId: input.examId, isActive: true }).lean();
    if (sections.length !== sectionIds.size) throw new ApiError(400, 'One or more sections do not belong to the selected exam', 'INVALID_SECTION_RELATIONSHIP');
  }
}

export async function validateTestForPublish(test: any) {
  await validateTestRelationships({ examId: test.examId.toString(), sections: test.sections.map((section: any) => ({ sectionId: section.sectionId.toString() })) });
  const mappings = await TestQuestion.find({ testId: test._id ?? test.id }).lean();
  if (!mappings.length || mappings.length !== test.totalQuestions) throw new ApiError(409, 'Test question count does not match configuration', 'INVALID_TEST_QUESTIONS');
  const questions = await Question.find({ _id: { $in: mappings.map(item => item.questionId) }, isActive: true }).lean();
  if (questions.length !== mappings.length) throw new ApiError(409, 'Test contains missing or inactive questions', 'INVALID_TEST_QUESTIONS');
  const questionSectionIds = new Set(questions.map(question => question.sectionId.toString()));
  const sections = await Section.find({ _id: { $in: [...questionSectionIds] }, examId: test.examId, isActive: true }).lean();
  if (sections.length !== questionSectionIds.size) throw new ApiError(409, 'Test contains questions from invalid sections', 'INVALID_QUESTION_RELATIONSHIP');

  const questionMap = new Map(questions.map(question => [question._id.toString(), question]));
  let totalMarks = 0;
  for (const mapping of mappings) {
    const question = questionMap.get(mapping.questionId.toString())!;
    if (mapping.sectionId && mapping.sectionId.toString() !== question.sectionId.toString()) throw new ApiError(409, 'Test question section does not match question section', 'INVALID_TEST_QUESTION_RELATIONSHIP');
    totalMarks += mapping.marks ?? question.defaultMarks;
  }
  if (Math.abs(totalMarks - test.totalMarks) > 0.000001) throw new ApiError(409, 'Test marks do not match mapped question marks', 'INVALID_TEST_MARKS');

  for (const configured of test.sections) {
    const mapped = mappings.filter((mapping: any) => {
      const question = questionMap.get(mapping.questionId.toString())!;
      return (mapping.sectionId?.toString() ?? question.sectionId.toString()) === configured.sectionId.toString();
    });
    const marks = mapped.reduce((sum: number, mapping: any) => sum + (mapping.marks ?? questionMap.get(mapping.questionId.toString())!.defaultMarks), 0);
    if (mapped.length !== configured.questionCount || Math.abs(marks - configured.marks) > 0.000001) throw new ApiError(409, `Section ${configured.sectionId} does not match mapped questions`, 'INVALID_TEST_SECTION_CONFIGURATION');
  }
}
