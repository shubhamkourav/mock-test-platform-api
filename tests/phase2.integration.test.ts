import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

let app: typeof import('../src/app').app;
let User: typeof import('../src/models/User').User;
let Exam: typeof import('../src/models/Exam').Exam;
let Section: typeof import('../src/models/Section').Section;
let Question: typeof import('../src/models/Question').Question;
let Test: typeof import('../src/models/Test').Test;
let TestQuestion: typeof import('../src/models/TestQuestion').TestQuestion;
let Attempt: typeof import('../src/models/Attempt').Attempt;
let AttemptAnswer: typeof import('../src/models/AttemptAnswer').AttemptAnswer;
let RefreshToken: typeof import('../src/models/RefreshToken').RefreshToken;
let mongo: MongoMemoryServer;

async function login(email: string, password: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createFixture() {
  const admin = await User.findOne({ role: 'admin' });
  const exam = await Exam.create({ name: `Phase 2 Exam ${Date.now()}`, slug: `phase-2-${Date.now()}`, category: 'Test' });
  const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 3, timeMinutes: 30, maxMarks: 6, negativeMarking: 1 });
  const questions = await Question.create([
    { sectionId: section.id, subjectTag: 'General', topic: 'Arithmetic', questionText: '2 + 2 = ?', options: [{ key: 'a', text: '4' }, { key: 'b', text: '5' }], correctOptions: ['a'], selectionMode: 'single', defaultMarks: 2, negativeMarks: 0.5 },
    { sectionId: section.id, subjectTag: 'General', topic: 'Logic', questionText: 'Select prime numbers', options: [{ key: 'a', text: '2' }, { key: 'b', text: '3' }, { key: 'c', text: '4' }], correctOptions: ['a', 'b'], selectionMode: 'multiple', defaultMarks: 3, negativeMarks: 1 },
    { sectionId: section.id, subjectTag: 'General', topic: 'General', questionText: 'Capital of India?', options: [{ key: 'a', text: 'Delhi' }, { key: 'b', text: 'Mumbai' }], correctOptions: ['a'], selectionMode: 'single', defaultMarks: 1, negativeMarks: 0 },
  ]);
  return { admin, exam, section, questions };
}

async function createPublishedTest(examId: string, sectionId: string, questions: Array<{ id: string }>, adminToken: string, title = `Test ${Date.now()}`) {
  const create = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${adminToken}`).send({ examId, title, type: 'full_mock', totalQuestions: 3, totalMarks: 6, durationMinutes: 30, sections: [{ sectionId, questionCount: 3, marks: 6, durationMinutes: 30 }] });
  expect(create.status).toBe(201);
  const testId = create.body.data._id;
  for (const [index, question] of questions.entries()) {
    const response = await request(app).post(`/api/v1/tests/${testId}/questions`).set('Authorization', `Bearer ${adminToken}`).send({ questionId: question.id, order: index + 1 });
    expect(response.status).toBe(201);
  }
  const publish = await request(app).post(`/api/v1/tests/${testId}/publish`).set('Authorization', `Bearer ${adminToken}`);
  expect(publish.status).toBe(200);
  return testId;
}

function expectStudentAttemptQuestionsToBeSanitized(questions: Array<Record<string, unknown>>) {
  expect(questions).not.toHaveLength(0);
  for (const question of questions) {
    expect(question).toHaveProperty('questionId');
    expect(question).not.toHaveProperty('correctOptions');
    expect(question).not.toHaveProperty('isCorrect');
    expect(question).not.toHaveProperty('marksObtained');
    expect(question).not.toHaveProperty('questionSnapshot');
    expect(JSON.stringify(question)).not.toContain('correctOptions');
  }
}

describe('phase 2 core API', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'phase2-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'phase2-refresh-secret-12345';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ({ app } = await import('../src/app'));
    ({ User } = await import('../src/models/User'));
    ({ Exam } = await import('../src/models/Exam'));
    ({ Section } = await import('../src/models/Section'));
    ({ Question } = await import('../src/models/Question'));
    ({ Test } = await import('../src/models/Test'));
    ({ TestQuestion } = await import('../src/models/TestQuestion'));
    ({ Attempt } = await import('../src/models/Attempt'));
    ({ AttemptAnswer } = await import('../src/models/AttemptAnswer'));
    ({ RefreshToken } = await import('../src/models/RefreshToken'));
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Exam.deleteMany({}), Section.deleteMany({}), Question.deleteMany({}), Test.deleteMany({}), TestQuestion.deleteMany({}), Attempt.deleteMany({}), AttemptAnswer.deleteMany({}), RefreshToken.deleteMany({})]);
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('Admin@12345', 12), role: 'admin' });
    await User.create({ name: 'Student', email: 'student@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
  });
  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

  it('supports complete exam and section management with authorization', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const createExam = await request(app).post('/api/v1/exams').set('Authorization', `Bearer ${admin.accessToken}`).send({ name: 'SSC CGL', slug: 'ssc-cgl', category: 'Government' });
    expect(createExam.status).toBe(201);
    const examId = createExam.body.data._id;
    expect((await request(app).patch(`/api/v1/exams/${examId}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ name: 'SSC CGL Updated' })).status).toBe(200);
    expect((await request(app).post(`/api/v1/exams/${examId}/sections`).set('Authorization', `Bearer ${admin.accessToken}`).send({ name: 'Quant', slug: 'quant', subjectTag: 'Quant', questionCount: 1, timeMinutes: 10, maxMarks: 2 })).status).toBe(201);
    const section = (await request(app).get(`/api/v1/exams/${examId}/sections`)).body.data[0];
    expect((await request(app).patch(`/api/v1/sections/${section._id}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ name: 'Quantitative' })).status).toBe(200);
    const emptySection = (await request(app).post(`/api/v1/exams/${examId}/sections`).set('Authorization', `Bearer ${admin.accessToken}`).send({ name: 'Empty', slug: 'empty', subjectTag: 'Empty', questionCount: 1, timeMinutes: 5, maxMarks: 1 })).body.data;
    expect((await request(app).delete(`/api/v1/sections/${emptySection._id}`).set('Authorization', `Bearer ${admin.accessToken}`)).status).toBe(200);
    expect((await request(app).post('/api/v1/exams').set('Authorization', `Bearer ${student.accessToken}`).send({ name: 'Forbidden', slug: 'forbidden', category: 'Test' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/sections/${section._id}`).set('Authorization', `Bearer ${student.accessToken}`).send({ name: 'Forbidden' })).status).toBe(403);
  });

  it('soft-deactivates questions and supports question filtering and validation', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const fixture = await createFixture();
    expect((await request(app).post('/api/v1/questions').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, sectionId: fixture.section.id, subjectTag: 'General', topic: 'x', questionText: 'bad', options: [{ key: 'a', text: 'a' }, { key: 'a', text: 'b' }], correctOptions: ['a'] })).status).toBe(400);
    expect((await request(app).post('/api/v1/questions').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, sectionId: fixture.section.id, subjectTag: 'General', topic: 'x', questionText: 'bad', options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }], correctOptions: ['c'] })).status).toBe(400);
    const list = await request(app).get(`/api/v1/questions?examId=${fixture.exam.id}&difficulty=medium&page=1&limit=2`);
    expect(list.status).toBe(200);
    expect(list.body.data.pagination.limit).toBe(2);
    const created = await request(app).post('/api/v1/questions').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, sectionId: fixture.section.id, subjectTag: 'General', topic: 'New', questionText: 'New question', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correctOptions: ['a'], difficulty: 'easy' });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    expect((await request(app).patch(`/api/v1/questions/${id}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ topic: 'Updated' })).status).toBe(200);
    expect((await request(app).delete(`/api/v1/questions/${id}`).set('Authorization', `Bearer ${admin.accessToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/questions/${id}`)).status).toBe(404);
  });

  it('supports test creation, mapping updates, reorder, publish and unpublish', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const fixture = await createFixture();
    const test = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, title: 'Builder test', type: 'full_mock', totalQuestions: 3, totalMarks: 6, durationMinutes: 30, sections: [{ sectionId: fixture.section.id, questionCount: 3, marks: 6, durationMinutes: 30 }] });
    expect(test.status).toBe(201);
    const testId = test.body.data._id;
    for (const [index, question] of fixture.questions.entries()) expect((await request(app).post(`/api/v1/tests/${testId}/questions`).set('Authorization', `Bearer ${admin.accessToken}`).send({ questionId: question.id, order: index + 1 })).status).toBe(201);
    expect((await request(app).patch(`/api/v1/tests/${testId}/questions/${fixture.questions[0].id}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ marks: 2 })).status).toBe(200);
    const reverse = await request(app).post(`/api/v1/tests/${testId}/reorder`).set('Authorization', `Bearer ${admin.accessToken}`).send({ items: fixture.questions.map((question, index) => ({ questionId: question.id, order: fixture.questions.length - index })) });
    expect(reverse.status).toBe(200);
    expect(reverse.body.data.map((mapping: any) => mapping.questionId)).toEqual([...fixture.questions].reverse().map(question => question.id));
    expect((await request(app).patch(`/api/v1/tests/${testId}/questions/${fixture.questions[0].id}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ order: 1_000_000 })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/tests/${testId}/questions/${fixture.questions[1].id}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ order: 5 })).status).toBe(200);
    const arbitrary = [{ questionId: fixture.questions[0].id, order: 1 }, { questionId: fixture.questions[1].id, order: 1_000_001 }, { questionId: fixture.questions[2].id, order: 50 }];
    const reordered = await request(app).post(`/api/v1/tests/${testId}/reorder`).set('Authorization', `Bearer ${admin.accessToken}`).send({ items: arbitrary });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.map((mapping: any) => [mapping.questionId, mapping.order])).toEqual([[fixture.questions[0].id, 1], [fixture.questions[2].id, 50], [fixture.questions[1].id, 1_000_001]]);
    expect((await request(app).post(`/api/v1/tests/${testId}/reorder`).set('Authorization', `Bearer ${admin.accessToken}`).send({ items: arbitrary })).status).toBe(200);
    expect((await request(app).post(`/api/v1/tests/${testId}/publish`).set('Authorization', `Bearer ${admin.accessToken}`)).status).toBe(200);
    expect((await request(app).patch(`/api/v1/tests/${testId}`).set('Authorization', `Bearer ${admin.accessToken}`).send({ title: 'Should fail' })).status).toBe(409);
    expect((await request(app).post(`/api/v1/tests/${testId}/unpublish`).set('Authorization', `Bearer ${admin.accessToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/tests/${testId}`)).status).toBe(404);
  });

  it('rejects invalid test relationships before publishing', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const fixture = await createFixture();
    const otherExam = await Exam.create({ name: 'Other', slug: `other-${Date.now()}`, category: 'Other' });
    const otherSection = await Section.create({ examId: otherExam.id, name: 'Other', slug: `other-section-${Date.now()}`, subjectTag: 'Other', questionCount: 1, timeMinutes: 10, maxMarks: 1 });
    const response = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, title: 'Bad', type: 'full_mock', totalQuestions: 1, totalMarks: 1, durationMinutes: 10, sections: [{ sectionId: otherSection.id, questionCount: 1, marks: 1, durationMinutes: 10 }] });
    expect(response.status).toBe(400);
  });

  it('supports attempt, resume, server-side scoring and rich result review', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createFixture();
    const testId = await createPublishedTest(fixture.exam.id, fixture.section.id, fixture.questions, admin.accessToken);
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    expect(started.status).toBe(201);
    expectStudentAttemptQuestionsToBeSanitized(started.body.data.questions);
    const attemptId = started.body.data.attempt._id;
    const resumed = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.attempt._id).toBe(attemptId);
    expectStudentAttemptQuestionsToBeSanitized(resumed.body.data.questions);
    const savedAnswer = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.questions[0].id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 10 });
    expect(savedAnswer.status).toBe(200);
    expect(savedAnswer.body.data).not.toHaveProperty('isCorrect');
    expect(savedAnswer.body.data).not.toHaveProperty('marksObtained');
    expect(savedAnswer.body.data).not.toHaveProperty('questionSnapshot');
    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.questions[1].id, selectedOptions: ['a', 'b'], markedForReview: true, timeSpentSeconds: 20 })).status).toBe(200);
    const submit = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(submit.status).toBe(200);
    expect(submit.body.data.totalScore).toBe(5);
    expect(submit.body.data.correctCount).toBe(2);
    expect(submit.body.data.unattemptedCount).toBe(1);
    const result = await request(app).get(`/api/v1/attempts/${attemptId}/result`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(result.status).toBe(200);
    expect(result.body.data.score).toBe(5);
    expect(result.body.data.totalMarks).toBe(6);
    expect(result.body.data.percentage).toBe(83.33);
    expect(result.body.data.accuracy).toBe(100);
    expect(result.body.data.review).toHaveLength(3);
    expect(result.body.data.review.some((item: any) => item.questionId === fixture.questions[2].id && item.isAttempted === false)).toBe(true);
    expect(result.body.data.review.find((item: any) => item.questionId === fixture.questions[1].id).correctOptions).toEqual(['a', 'b']);
  });

  it('applies negative marking and rejects cross-student attempt/result access', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const otherUser = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
    const otherStudent = await login(otherUser.email, 'Student@12345');
    const fixture = await createFixture();
    const testId = await createPublishedTest(fixture.exam.id, fixture.section.id, fixture.questions, admin.accessToken);
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    const attemptId = started.body.data.attempt._id;
    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.questions[0].id, selectedOptions: ['b'], markedForReview: false, timeSpentSeconds: 1 })).status).toBe(200);
    const submitted = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(submitted.body.data.totalScore).toBe(-0.5);
    expect((await request(app).get(`/api/v1/attempts/${attemptId}`).set('Authorization', `Bearer ${otherStudent.accessToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/attempts/${attemptId}/result`).set('Authorization', `Bearer ${otherStudent.accessToken}`)).status).toBe(404);
  });

  it('does not allow students to mutate test/question resources or start an unpublished test', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createFixture();
    const draft = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, title: 'Draft', type: 'full_mock', totalQuestions: 3, totalMarks: 6, durationMinutes: 30, sections: [{ sectionId: fixture.section.id, questionCount: 3, marks: 6, durationMinutes: 30 }] });
    const draftId = draft.body.data._id;
    expect((await request(app).post(`/api/v1/tests/${draftId}/questions`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.questions[0].id, order: 1 })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/questions/${fixture.questions[0].id}`).set('Authorization', `Bearer ${student.accessToken}`).send({ topic: 'bad' })).status).toBe(403);
    expect((await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: draftId })).status).toBe(404);
  });

  it('keeps draft tests private while allowing admins to manage them', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createFixture();
    const publishedId = await createPublishedTest(fixture.exam.id, fixture.section.id, fixture.questions, admin.accessToken);
    const draft = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: fixture.exam.id, title: 'Admin draft', type: 'full_mock', totalQuestions: 3, totalMarks: 6, durationMinutes: 30, sections: [{ sectionId: fixture.section.id, questionCount: 3, marks: 6, durationMinutes: 30 }] });
    expect(draft.status).toBe(201);
    const draftId = draft.body.data._id;
    expect((await request(app).get(`/api/v1/tests/${publishedId}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/tests/${draftId}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/tests')).body.data.map((test: any) => test._id)).toContain(publishedId);
    expect((await request(app).get('/api/v1/tests?includeUnpublished=true').set('Authorization', `Bearer ${student.accessToken}`)).body.data.map((test: any) => test._id)).not.toContain(draftId);
    expect((await request(app).get(`/api/v1/tests/${draftId}`).set('Authorization', `Bearer ${student.accessToken}`)).status).toBe(404);
    const adminList = await request(app).get('/api/v1/tests?includeUnpublished=true').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.map((test: any) => test._id)).toContain(draftId);
    expect((await request(app).get(`/api/v1/tests/${draftId}`).set('Authorization', `Bearer ${admin.accessToken}`)).status).toBe(200);
  });

  it('expires attempts server-side and keeps submission idempotent', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createFixture();
    const testId = await createPublishedTest(fixture.exam.id, fixture.section.id, fixture.questions, admin.accessToken, `Expiry ${Date.now()}`);
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    const attemptId = started.body.data.attempt._id;
    await Attempt.updateOne({ _id: attemptId }, { $set: { startTime: new Date(Date.now() - 31 * 60_000) } });
    const answer = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.questions[0].id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(answer.status).toBe(409);
    const first = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`);
    const second = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe(first.body.data.status);
  });
});
