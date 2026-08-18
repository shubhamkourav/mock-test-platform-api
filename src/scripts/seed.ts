import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { User } from '../models/User';
import { Exam } from '../models/Exam';
import { Section } from '../models/Section';
import { Question } from '../models/Question';
import { Test } from '../models/Test';
import { TestQuestion } from '../models/TestQuestion';

async function seed() {
  await connectDatabase();

  await Promise.all([
    User.deleteMany({}),
    Exam.deleteMany({}),
    Section.deleteMany({}),
    Question.deleteMany({}),
    Test.deleteMany({}),
    TestQuestion.deleteMany({}),
  ]);

  const [admin, student] = await User.create([
    {
      name: 'Platform Admin',
      email: 'admin@mocktest.local',
      passwordHash: await bcrypt.hash('Admin@12345', 12),
      role: 'admin',
    },
    {
      name: 'Demo Student',
      email: 'student@mocktest.local',
      passwordHash: await bcrypt.hash('Student@12345', 12),
      role: 'student',
    },
  ]);

  const exam = await Exam.create({
    name: 'IBPS PO',
    slug: 'ibps-po',
    category: 'Banking',
    conductingBody: 'IBPS',
    examPatternNotes: 'Prelims: 100 questions / 60 minutes.',
  });

  student.targetExamIds = [exam.id];
  await student.save();

  const sections = await Section.create([
    {
      examId: exam.id, stage: 'prelims', name: 'Quantitative Aptitude',
      slug: 'quantitative-aptitude', subjectTag: 'Quant', questionCount: 35,
      timeMinutes: 20, maxMarks: 35, negativeMarking: 0.25, order: 1,
    },
    {
      examId: exam.id, stage: 'prelims', name: 'Reasoning Ability',
      slug: 'reasoning-ability', subjectTag: 'Reasoning', questionCount: 35,
      timeMinutes: 20, maxMarks: 35, negativeMarking: 0.25, order: 2,
    },
    {
      examId: exam.id, stage: 'prelims', name: 'English Language',
      slug: 'english-language', subjectTag: 'English', questionCount: 30,
      timeMinutes: 20, maxMarks: 30, negativeMarking: 0.25, order: 3,
    },
  ]);

  const questions = await Question.create([
    {
      sectionId: sections[0].id, subjectTag: 'Quant', topic: 'Simplification',
      questionText: 'What is 15% of 240 + 20% of 150?',
      options: [{ key: 'a', text: '66' }, { key: 'b', text: '68' }, { key: 'c', text: '70' }, { key: 'd', text: '72' }],
      correctOptions: ['a'], explanation: '15% of 240 = 36 and 20% of 150 = 30. Total = 66.',
      defaultMarks: 1, negativeMarks: 0.25, difficulty: 'easy', source: 'original',
    },
    {
      sectionId: sections[0].id, subjectTag: 'Quant', topic: 'Percentage',
      questionText: 'A value increases from 200 to 240. What is the percentage increase?',
      options: [{ key: 'a', text: '15%' }, { key: 'b', text: '20%' }, { key: 'c', text: '25%' }, { key: 'd', text: '30%' }],
      correctOptions: ['b'], explanation: 'Increase is 40. 40/200 × 100 = 20%.',
      defaultMarks: 1, negativeMarks: 0.25, difficulty: 'easy', source: 'original',
    },
    {
      sectionId: sections[1].id, subjectTag: 'Reasoning', topic: 'Analogy',
      questionText: 'Book is to Reading as Fork is to ?',
      options: [{ key: 'a', text: 'Writing' }, { key: 'b', text: 'Drawing' }, { key: 'c', text: 'Eating' }, { key: 'd', text: 'Cooking' }],
      correctOptions: ['c'], explanation: 'A book is used for reading; a fork is used for eating.',
      defaultMarks: 1, negativeMarks: 0.25, difficulty: 'easy', source: 'original',
    },
    {
      sectionId: sections[2].id, subjectTag: 'English', topic: 'Vocabulary',
      questionText: 'Choose the word closest in meaning to “Abundant”.',
      options: [{ key: 'a', text: 'Scarce' }, { key: 'b', text: 'Plentiful' }, { key: 'c', text: 'Tiny' }, { key: 'd', text: 'Weak' }],
      correctOptions: ['b'], explanation: 'Abundant means plentiful or available in large quantities.',
      defaultMarks: 1, negativeMarks: 0.25, difficulty: 'easy', source: 'original',
    },
  ]);

  const test = await Test.create({
    examId: exam.id,
    stage: 'prelims',
    title: 'IBPS PO Prelims Mock 1',
    type: 'full_mock',
    totalQuestions: questions.length,
    totalMarks: questions.length,
    durationMinutes: 60,
    difficulty: 'mixed',
    sections: sections.map((section, index) => ({
      sectionId: section.id,
      questionCount: index === 0 ? 2 : 1,
      marks: index === 0 ? 2 : 1,
      durationMinutes: 20,
    })),
    isPublished: true,
    createdBy: admin.id,
  });

  await TestQuestion.insertMany(questions.map((question, index) => ({
    testId: test.id,
    questionId: question.id,
    sectionId: question.sectionId,
    order: index + 1,
    marks: 1,
  })));

  console.log('Seed complete.');
  console.log({ examId: exam.id, testId: test.id });
  await disconnectDatabase();
}

seed().catch(async error => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
