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
let mongo: MongoMemoryServer;

async function login(email: string, password: string) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function createPublishedTest(adminId: string) {
  const exam = await Exam.create({ name: `Security Exam ${Date.now()}`, slug: `security-${Date.now()}`, category: 'Test' });
  const section = await Section.create({ examId: exam.id, name: 'General', slug: `general-${Date.now()}`, subjectTag: 'General', questionCount: 1, timeMinutes: 10, maxMarks: 1 });
  const question = await Question.create({
    sectionId: section.id,
    subjectTag: 'General',
    topic: 'Security',
    questionText: '2 + 2 = ?',
    options: [{ key: 'a', text: '4' }, { key: 'b', text: '5' }],
    correctOptions: ['a'],
    selectionMode: 'single',
    defaultMarks: 1,
    negativeMarks: 0,
  });
  const test = await Test.create({
    examId: exam.id,
    title: 'Security test',
    type: 'full_mock',
    totalQuestions: 1,
    totalMarks: 1,
    durationMinutes: 10,
    sections: [{ sectionId: section.id, questionCount: 1, marks: 1, durationMinutes: 10 }],
    isPublished: true,
    createdBy: adminId,
  });
  await TestQuestion.create({ testId: test.id, questionId: question.id, sectionId: section.id, order: 1, marks: 1 });
  return { exam, section, question, test };
}

describe('phase 2 security hardening', () => {
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
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Exam.deleteMany({}),
      Section.deleteMany({}),
      Question.deleteMany({}),
      Test.deleteMany({}),
      TestQuestion.deleteMany({}),
    ]);
    await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('Admin@12345', 12), role: 'admin' });
    await User.create({ name: 'Student', email: 'student@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('keeps POST and GET active attempts free of scoring and answer-key fields', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createPublishedTest(admin.user.id);

    const started = await request(app)
      .post('/api/v1/attempts')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ testId: fixture.test.id });

    expect(started.status).toBe(201);
    const attempt = started.body.data.attempt;
    const attemptId = attempt._id;
    expect(attempt).toMatchObject({ userId: student.user.id, testId: fixture.test.id, status: 'in_progress' });
    for (const field of ['score', 'totalScore', 'percentage', 'accuracy', 'correctCount', 'incorrectCount', 'unattemptedCount', 'marksObtained', 'correctOptions', 'isCorrect', 'questionSnapshot', 'sectionResults']) {
      expect(attempt).not.toHaveProperty(field);
    }

    const fetched = await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${student.accessToken}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.data.attempt).toMatchObject({ _id: attemptId, userId: student.user.id, testId: fixture.test.id, status: 'in_progress' });
    for (const field of ['score', 'totalScore', 'percentage', 'accuracy', 'correctCount', 'incorrectCount', 'unattemptedCount', 'marksObtained', 'correctOptions', 'isCorrect', 'questionSnapshot', 'sectionResults']) {
      expect(fetched.body.data.attempt).not.toHaveProperty(field);
    }
    expect(fetched.body.data.answers).toEqual([]);

    const saved = await request(app)
      .post(`/api/v1/attempts/${attemptId}/answers`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ questionId: fixture.question.id, selectedOptions: ['a'], markedForReview: true, timeSpentSeconds: 5 });

    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ questionId: fixture.question.id, selectedOptions: ['a'], markedForReview: true, timeSpentSeconds: 5, isAttempted: true });
    for (const field of ['marksObtained', 'correctOptions', 'isCorrect', 'questionSnapshot']) expect(saved.body.data).not.toHaveProperty(field);

    const fetchedAfterAnswer = await request(app)
      .get(`/api/v1/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${student.accessToken}`);
    expect(fetchedAfterAnswer.status).toBe(200);
    expect(fetchedAfterAnswer.body.data.answers).toEqual([expect.objectContaining({ questionId: fixture.question.id, selectedOptions: ['a'], markedForReview: true, timeSpentSeconds: 5, isAttempted: true })]);
  });

  it('preserves ownership checks and the submitted result contract', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    await User.create({ name: 'Other', email: 'other@example.com', passwordHash: await bcrypt.hash('Student@12345', 12), role: 'student' });
    const other = await login('other@example.com', 'Student@12345');
    const fixture = await createPublishedTest(admin.user.id);

    const started = await request(app).post('/api/v1/attempts').set('Authorization', `Bearer ${student.accessToken}`).send({ testId: fixture.test.id });
    const attemptId = started.body.data.attempt._id;

    expect((await request(app).get(`/api/v1/attempts/${attemptId}`).set('Authorization', `Bearer ${other.accessToken}`)).status).toBe(404);

    expect((await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${student.accessToken}`).send({ questionId: fixture.question.id, selectedOptions: ['a'], markedForReview: false, timeSpentSeconds: 2 })).status).toBe(200);
    const submitted = await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.totalScore).toBe(1);
    expect(submitted.body.data.correctCount).toBe(1);

    const result = await request(app).get(`/api/v1/attempts/${attemptId}/result`).set('Authorization', `Bearer ${student.accessToken}`);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ score: 1, totalMarks: 1, correct: 1, incorrect: 0, unattempted: 0, status: 'completed' });
    expect(result.body.data.review[0]).toMatchObject({ questionId: fixture.question.id, isCorrect: true, correctOptions: ['a'], marksObtained: 1 });
  });

  it('protects inactive question enumeration and keeps active question reads student-safe', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createPublishedTest(admin.user.id);
    await Question.findByIdAndUpdate(fixture.question.id, { isActive: false });

    const publicInactive = await request(app).get('/api/v1/questions?active=false');
    expect(publicInactive.status).toBe(403);

    const studentInactive = await request(app).get('/api/v1/questions?active=false').set('Authorization', `Bearer ${student.accessToken}`);
    expect(studentInactive.status).toBe(403);

    const adminInactive = await request(app).get('/api/v1/questions?active=false').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminInactive.status).toBe(200);
    expect(adminInactive.body.data.items).toHaveLength(1);
    expect(adminInactive.body.data.items[0]).not.toHaveProperty('correctOptions');

    const adminQuestion = await Question.findById(fixture.question.id);
    adminQuestion!.isActive = true;
    await adminQuestion!.save();

    const publicQuestion = await request(app).get(`/api/v1/questions/${fixture.question.id}`);
    expect(publicQuestion.status).toBe(200);
    expect(publicQuestion.body.data).not.toHaveProperty('correctOptions');

    const adminQuestionRead = await request(app).get(`/api/v1/questions/${fixture.question.id}`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminQuestionRead.status).toBe(200);
    expect(adminQuestionRead.body.data.correctOptions).toEqual(['a']);

    const unauthenticatedAttemptToRequestAdminFields = await request(app).get(`/api/v1/questions/${fixture.question.id}?includeCorrectOptions=true`);
    expect(unauthenticatedAttemptToRequestAdminFields.status).toBe(200);
    expect(unauthenticatedAttemptToRequestAdminFields.body.data).not.toHaveProperty('correctOptions');
  });

  it('requires admin authentication for inactive exams and sections while preserving public active listings', async () => {
    const admin = await login('admin@example.com', 'Admin@12345');
    const student = await login('student@example.com', 'Student@12345');
    const fixture = await createPublishedTest(admin.user.id);
    await Exam.findByIdAndUpdate(fixture.exam.id, { isActive: false });
    await Section.findByIdAndUpdate(fixture.section.id, { isActive: false });

    expect((await request(app).get('/api/v1/exams?includeInactive=true')).status).toBe(401);
    expect((await request(app).get('/api/v1/exams?includeInactive=true').set('Authorization', `Bearer ${student.accessToken}`)).status).toBe(403);
    const adminExams = await request(app).get('/api/v1/exams?includeInactive=true').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminExams.status).toBe(200);
    expect(adminExams.body.data.some((exam: { _id: string }) => exam._id === fixture.exam.id)).toBe(true);

    expect((await request(app).get(`/api/v1/exams/${fixture.exam.id}/sections?includeInactive=true`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/exams/${fixture.exam.id}/sections?includeInactive=true`).set('Authorization', `Bearer ${student.accessToken}`)).status).toBe(403);
    const adminSections = await request(app).get(`/api/v1/exams/${fixture.exam.id}/sections?includeInactive=true`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminSections.status).toBe(200);
    expect(adminSections.body.data.some((section: { _id: string }) => section._id === fixture.section.id)).toBe(true);
  });
});
