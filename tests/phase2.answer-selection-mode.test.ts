import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
let mongo: MongoMemoryServer;

async function login(email: string, password: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createPublishedTest(adminToken: string, singleQuestion: { id: string }, multipleQuestion: { id: string }) {
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('Admin fixture was not created');
  const exam = await Exam.create({ name: `Selection Mode ${Date.now()}`, slug: `selection-mode-${Date.now()}`, category: 'Test' });
  const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 2, timeMinutes: 30, maxMarks: 3 });
  await Question.updateMany({ _id: { $in: [singleQuestion.id, multipleQuestion.id] } }, { $set: { sectionId: section.id } });
  const test = await Test.create({ examId: exam.id, title: `Selection test ${Date.now()}`, type: 'full_mock', totalQuestions: 2, totalMarks: 3, durationMinutes: 30, sections: [{ sectionId: section.id, questionCount: 2, marks: 3, durationMinutes: 30 }], isPublished: false, createdBy: admin.id });
  for (const [index, question] of [singleQuestion, multipleQuestion].entries()) {
    const mapping = await request(app).post(`/api/v1/tests/${test.id}/questions`).set('Authorization', `Bearer ${adminToken}`).send({ questionId: question.id, order: index + 1 });
    expect(mapping.status).toBe(201);
  }
  const publish = await request(app).post(`/api/v1/tests/${test.id}/publish`).set('Authorization', `Bearer ${adminToken}`);
  expect(publish.status).toBe(200);
  return test.id;
}

async function createAttemptFixture() {
  const adminToken = (await login('admin@example.com', 'Admin@12345')).accessToken;
  const studentToken = (await login('student@example.com', 'Student@12345')).accessToken;
  const singleQuestion = await Question.create({ sectionId: new mongoose.Types.ObjectId(), subjectTag: 'General', topic: 'Arithmetic', questionText: '2 + 2 = ?', options: [{ key: 'a', text: '4' }, { key: 'b', text: '5' }], correctOptions: ['a'], selectionMode: 'single', defaultMarks: 1, negativeMarks: 0.5 });
  const multipleQuestion = await Question.create({ sectionId: new mongoose.Types.ObjectId(), subjectTag: 'General', topic: 'Logic', questionText: 'Select prime numbers', options: [{ key: 'a', text: '2' }, { key: 'b', text: '3' }, { key: 'c', text: '4' }], correctOptions: ['a', 'b'], selectionMode: 'multiple', defaultMarks: 2, negativeMarks: 1 });
  const testId = await createPublishedTest(adminToken, singleQuestion, multipleQuestion);
  const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${studentToken}`).send({ testId });
  expect(started.status).toBe(201);
  return { adminToken, studentToken, testId, attemptId: started.body.data.attempt._id, singleQuestion, multipleQuestion };
}

describe('phase 2 answer selection mode enforcement', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'selection-mode-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'selection-mode-refresh-secret-12345';
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
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Exam.deleteMany({}), Section.deleteMany({}), Question.deleteMany({}), Test.deleteMany({}), TestQuestion.deleteMany({}), Attempt.deleteMany({}), AttemptAnswer.deleteMany({})]);
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('Admin@12345', 12), role: 'admin' });
    await User.create({ name: 'Student', email: 'student@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('allows zero selected options for a single-selection question', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: [], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual([]);
  });

  it('allows one selected option for a single-selection question', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual(['a']);
  });

  it('rejects multiple selected options for a single-selection question with the existing API error shape', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a', 'b'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'INVALID_SELECTION_MODE' });
  });

  it('allows zero selected options for a multiple-selection question', async () => {
    const { studentToken, attemptId, multipleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: multipleQuestion.id, selectedOptions: [], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual([]);
  });

  it('allows one selected option for a multiple-selection question', async () => {
    const { studentToken, attemptId, multipleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: multipleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual(['a']);
  });

  it('allows multiple selected options for a multiple-selection question', async () => {
    const { studentToken, attemptId, multipleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: multipleQuestion.id, selectedOptions: ['a', 'b'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual(['a', 'b']);
  });

  it('keeps invalid option-key validation enforced', async () => {
    const { studentToken, attemptId, multipleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: multipleQuestion.id, selectedOptions: ['z'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_OPTIONS');
  });

  it('accepts valid option keys and preserves deduplication', async () => {
    const { studentToken, attemptId, multipleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: multipleQuestion.id, selectedOptions: ['a', 'b', 'a'], markedForReview: true, timeSpentSeconds: 3 });
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOptions).toEqual(['a', 'b']);
  });

  it('keeps the answer-save response student-safe', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ questionId: singleQuestion.id, selectedOptions: ['a'] }));
  });

  it('does not return correctOptions from the pre-submission answer endpoint', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.body.data).not.toHaveProperty('correctOptions');
  });

  it('does not return scoring fields from the pre-submission answer endpoint', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.body.data).not.toHaveProperty('isCorrect');
    expect(response.body.data).not.toHaveProperty('marksObtained');
  });

  it('does not expose questionSnapshot from the pre-submission answer endpoint', async () => {
    const { studentToken, attemptId, singleQuestion } = await createAttemptFixture();
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.body.data).not.toHaveProperty('questionSnapshot');
    expect(JSON.stringify(response.body.data)).not.toContain('correctOptions');
  });

  it('rejects unauthorized access to another student attempt', async () => {
    const fixture = await createAttemptFixture();
    const otherUser = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
    const otherToken = (await login(otherUser.email, 'Student@12345')).accessToken;
    const response = await request(app).get(`/api/v1/attempts/${fixture.attemptId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ATTEMPT_NOT_FOUND');
  });

  it('rejects another student from modifying the attempt', async () => {
    const fixture = await createAttemptFixture();
    const otherUser = await User.create({ name: 'Other', email: 'other@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
    const otherToken = (await login(otherUser.email, 'Student@12345')).accessToken;
    const response = await request(app).post(`/api/v1/attempts/${fixture.attemptId}/answers`).set('Authorization', `Bearer ${otherToken}`).send({ questionId: fixture.singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ATTEMPT_NOT_FOUND');
  });

  it('preserves expired-attempt answer behavior', async () => {
    const fixture = await createAttemptFixture();
    await Attempt.updateOne({ _id: fixture.attemptId }, { $set: { startTime: new Date(Date.now() - 31 * 60_000) } });
    const response = await request(app).post(`/api/v1/attempts/${fixture.attemptId}/answers`).set('Authorization', `Bearer ${fixture.studentToken}`).send({ questionId: fixture.singleQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ATTEMPT_EXPIRED');
  });
});
