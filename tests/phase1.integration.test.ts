import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let app: typeof import('../src/app').app;
let User: typeof import('../src/models/User').User;
let Exam: typeof import('../src/models/Exam').Exam;
let Section: typeof import('../src/models/Section').Section;
let Question: typeof import('../src/models/Question').Question;
let Test: typeof import('../src/models/Test').Test;
let TestQuestion: typeof import('../src/models/TestQuestion').TestQuestion;
let RefreshToken: typeof import('../src/models/RefreshToken').RefreshToken;
let mongo: MongoMemoryServer;

async function login(email: string, password: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function makeFixture(durationMinutes = 60) {
  const exam = await Exam.create({ name: `Exam ${Date.now()}`, slug: `exam-${Date.now()}`, category: 'Test' });
  const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 2, timeMinutes: 60, maxMarks: 10 });
  const question = await Question.create({ sectionId: section.id, subjectTag: 'General', topic: 'Basics', questionText: '2 + 2 = ?', options: [{ key: 'a', text: '4' }, { key: 'b', text: '5' }], correctOptions: ['a'], defaultMarks: 1, negativeMarks: 0.25 });
  const unrelatedQuestion = await Question.create({ sectionId: section.id, subjectTag: 'General', topic: 'Basics', questionText: '3 + 3 = ?', options: [{ key: 'a', text: '6' }, { key: 'b', text: '7' }], correctOptions: ['a'] });
  const test = await Test.create({ examId: exam.id, title: `Mock ${Date.now()}`, type: 'full_mock', totalQuestions: 1, totalMarks: 5, durationMinutes, sections: [{ sectionId: section.id, questionCount: 1, marks: 5, durationMinutes }], isPublished: true, createdBy: (await User.findOne({ role: 'admin' }))!.id });
  await TestQuestion.create({ testId: test.id, questionId: question.id, sectionId: section.id, order: 1, marks: 5 });
  return { exam, section, question, unrelatedQuestion, test };
}

describe('phase 1 security and correctness', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/phase1';
    process.env.JWT_ACCESS_SECRET = 'phase1-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'phase1-refresh-secret-12345';
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
    ({ RefreshToken } = await import('../src/models/RefreshToken'));
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Exam.deleteMany({}), Section.deleteMany({}), Question.deleteMany({}), Test.deleteMany({}), TestQuestion.deleteMany({}), RefreshToken.deleteMany({}), mongoose.model('Attempt').deleteMany({}), mongoose.model('AttemptAnswer').deleteMany({})]);
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('Admin@12345', 12), role: 'admin' });
    await User.create({ name: 'Student', email: 'student@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
  });

  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

  it('does not allow public registration to create an admin', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ name: 'Attacker', email: 'attacker@example.com', password: 'Password@123', role: 'admin' });
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('student');
  });

  it('denies students access to admin endpoints', async () => {
    const student = await login('student@example.com', 'Student@12345');
    const response = await request(app).post('/api/v1/exams').set('Authorization', `Bearer ${student.accessToken}`).send({ name: 'Nope', slug: 'nope', category: 'Test' });
    expect(response.status).toBe(403);
  });

  it('rejects invalid refresh tokens and prevents reuse after rotation', async () => {
    const session = await login('student@example.com', 'Student@12345');
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(rotated.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken })).status).toBe(401);
    const expired = jwt.sign({ sub: session.user.id, role: 'student', jti: 'expired-jti', type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: -1 });
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: expired })).status).toBe(401);
  });

  it('prevents duplicate active attempts and resumes the existing attempt', async () => {
    const { test } = await makeFixture();
    const student = await login('student@example.com', 'Student@12345');
    const first = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: test.id });
    const second = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: test.id });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.attempt._id).toBe(first.body.data.attempt._id);
  });

  it('prevents cross-attempt and unrelated-question writes', async () => {
    const { test, question, unrelatedQuestion } = await makeFixture();
    const student1 = await login('student@example.com', 'Student@12345');
    const student2User = await User.create({ name: 'Student 2', email: 'student2@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
    const student2 = await login(student2User.email, 'Student@12345');
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student1.accessToken}`).send({ testId: test.id });
    const attemptId = started.body.data.attempt._id;
    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student1.accessToken}`).send({ questionId: unrelatedQuestion.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student2.accessToken}`).send({ questionId: question.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 })).status).toBe(404);
    expect((await request(app).get(`/api/v1/attempts/${attemptId}/result`).set('Authorization', `Bearer ${student2.accessToken}`)).status).toBe(404);
  });

  it('enforces the server deadline and makes submission idempotent', async () => {
    const { test } = await makeFixture(1);
    const student = await login('student@example.com', 'Student@12345');
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: test.id });
    const attemptId = started.body.data.attempt._id;
    await mongoose.model('Attempt').updateOne({ _id: attemptId }, { $set: { startTime: new Date(Date.now() - 120_000) } });
    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: started.body.data.questions[0].questionId, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1 })).status).toBe(409);
    const first = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`).send({});
    const second = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`).send({});
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe(first.body.data.status);
  });

  it('uses published TestQuestion marks and rejects invalid published tests', async () => {
    const { test, question } = await makeFixture();
    const student = await login('student@example.com', 'Student@12345');
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: test.id });
    const attemptId = started.body.data.attempt._id;
    await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: question.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 1, marksObtained: 999999 });
    const result = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`).send({});
    expect(result.body.data.totalScore).toBe(5);
    const invalid = await Test.create({ examId: test.examId, title: 'Invalid', type: 'full_mock', totalQuestions: 1, totalMarks: 1, durationMinutes: 10, isPublished: true, createdBy: test.createdBy });
    expect((await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: invalid.id })).status).toBe(409);
  });

  it('rejects invalid exam/section/question relationships', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const first = await makeFixture();
    const secondExam = await Exam.create({ name: `Second ${Date.now()}`, slug: `second-${Date.now()}`, category: 'Test' });
    const badSection = await Section.create({ examId: secondExam.id, name: 'Other', slug: `other-${Date.now()}`, subjectTag: 'Other', questionCount: 1, timeMinutes: 10, maxMarks: 1 });
    const invalidTest = await request(app).post('/api/v1/tests').set('Authorization', `Bearer ${admin.accessToken}`).send({ examId: first.exam.id, title: 'Bad', type: 'full_mock', totalQuestions: 1, totalMarks: 1, durationMinutes: 10, sections: [{ sectionId: badSection.id, questionCount: 1, marks: 1, durationMinutes: 10 }] });
    expect(invalidTest.status).toBe(400);
    const invalidQuestion = await request(app).post('/api/v1/questions').set('Authorization', `Bearer ${admin.accessToken}`).send({ sectionId: secondExam.id, subjectTag: 'x', topic: 'x', questionText: 'x', options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }], correctOptions: ['a'] });
    expect(invalidQuestion.status).toBe(400);
  });
});
