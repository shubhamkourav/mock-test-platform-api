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
let RefreshToken: typeof import('../src/models/RefreshToken').RefreshToken;
let mongo: MongoMemoryServer;

async function login(email: string, password: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createPublishedTest(adminToken: string, examId: string, sectionId: string, questionId: string) {
  const test = await Test.create({
    examId,
    stage: 'prelims',
    title: `Selection contract ${Date.now()}`,
    type: 'full_mock',
    totalQuestions: 1,
    totalMarks: 1,
    durationMinutes: 30,
    sections: [{ sectionId, questionCount: 1, marks: 1, durationMinutes: 30 }],
    isPublished: false,
    createdBy: (await User.findOne({ role: 'admin' }))!.id,
  });

  const mapping = await request(app)
    .post(`/api/v1/tests/${test.id}/questions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ questionId, order: 1 });
  expect(mapping.status).toBe(201);

  const publish = await request(app)
    .post(`/api/v1/tests/${test.id}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(publish.status).toBe(200);

  return test.id;
}

describe('phase 2 question selection contract', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'selection-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'selection-refresh-secret-12345';
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
    await Promise.all([
      User.deleteMany({}), Exam.deleteMany({}), Section.deleteMany({}), Question.deleteMany({}),
      Test.deleteMany({}), TestQuestion.deleteMany({}), Attempt.deleteMany({}), AttemptAnswer.deleteMany({}), RefreshToken.deleteMany({}),
    ]);
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('Admin@12345', 12), role: 'admin' });
    await User.create({ name: 'Student', email: 'student@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('validates, persists, and updates selectionMode', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const exam = await Exam.create({ name: 'Selection Exam', slug: `selection-${Date.now()}`, category: 'Test' });
    const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 1, timeMinutes: 30, maxMarks: 1 });

    const invalid = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ sectionId: section.id, subjectTag: 'General', topic: 'Selection', questionText: 'Invalid', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correctOptions: ['a'], selectionMode: 'many' });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ sectionId: section.id, subjectTag: 'General', topic: 'Selection', questionText: 'Select all', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correctOptions: ['a', 'b'], selectionMode: 'multiple' });
    expect(created.status).toBe(201);
    expect(created.body.data.selectionMode).toBe('multiple');

    const updated = await request(app)
      .patch(`/api/v1/questions/${created.body.data._id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ selectionMode: 'single' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.selectionMode).toBe('single');
  });

  it('defaults existing/new questions to single without exposing answer keys to students', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const exam = await Exam.create({ name: 'Selection Exam', slug: `selection-${Date.now()}`, category: 'Test' });
    const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 1, timeMinutes: 30, maxMarks: 1 });
    const question = await Question.create({ sectionId: section.id, subjectTag: 'General', topic: 'Selection', questionText: 'Select one', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correctOptions: ['a'] });
    expect(question.selectionMode).toBe('single');

    const testId = await createPublishedTest(admin.accessToken, exam.id, section.id, question.id);
    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    expect(started.status).toBe(201);
    expect(started.body.data.resumed).toBe(false);
    expect(started.body.data.questions[0].selectionMode).toBe('single');
    expect(started.body.data.questions[0]).not.toHaveProperty('correctOptions');
    expect(started.body.data.questions[0]).not.toHaveProperty('isCorrect');
    expect(started.body.data.questions[0]).not.toHaveProperty('marksObtained');
    expect(started.body.data.questions[0]).not.toHaveProperty('questionSnapshot');
    expect(JSON.stringify(started.body.data.questions[0])).not.toContain('correctOptions');

    const resumed = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.resumed).toBe(true);
    expect(resumed.body.data.attempt._id).toBe(started.body.data.attempt._id);
    expect(resumed.body.data.questions[0].selectionMode).toBe('single');
  });

  it('returns multiple selection mode without exposing answer keys', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const exam = await Exam.create({ name: 'Multi Exam', slug: `multi-${Date.now()}`, category: 'Test' });
    const section = await Section.create({ examId: exam.id, name: 'General', slug: `multi-general-${Date.now()}`, subjectTag: 'General', questionCount: 1, timeMinutes: 30, maxMarks: 1 });
    const question = await Question.create({ sectionId: section.id, subjectTag: 'General', topic: 'Selection', questionText: 'Select all', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }, { key: 'c', text: 'C' }], correctOptions: ['a', 'b'], selectionMode: 'multiple' });
    const testId = await createPublishedTest(admin.accessToken, exam.id, section.id, question.id);

    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId });
    expect(started.status).toBe(201);
    expect(started.body.data.questions[0].selectionMode).toBe('multiple');
    expect(started.body.data.questions[0]).not.toHaveProperty('correctOptions');
  });
});
