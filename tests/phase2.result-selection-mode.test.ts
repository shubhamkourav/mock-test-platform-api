import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

let app: typeof import('../src/app').app;
let User: typeof import('../src/models/User').User;
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

describe('phase 2 result selection mode contract', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'phase2-result-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'phase2-result-refresh-secret-12345';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ({ app } = await import('../src/app'));
    ({ User } = await import('../src/models/User'));
    ({ Question } = await import('../src/models/Question'));
    ({ Test } = await import('../src/models/Test'));
    ({ TestQuestion } = await import('../src/models/TestQuestion'));
    ({ Attempt } = await import('../src/models/Attempt'));
    ({ AttemptAnswer } = await import('../src/models/AttemptAnswer'));
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Question.deleteMany({}),
      Test.deleteMany({}),
      TestQuestion.deleteMany({}),
      Attempt.deleteMany({}),
      AttemptAnswer.deleteMany({}),
    ]);
    await User.create({
      name: 'Student',
      email: 'student@example.com',
      passwordHash: await bcrypt.hash('Student@12345', 12),
      role: 'student',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('returns authoritative single and multiple selection modes in result review without changing existing review fields', async () => {
    const student = await User.findOne({ email: 'student@example.com' });
    if (!student) throw new Error('Student fixture was not created');

    const sectionId = new mongoose.Types.ObjectId();
    const testId = new mongoose.Types.ObjectId();
    const singleQuestion = await Question.create({
      sectionId,
      subjectTag: 'General',
      topic: 'Arithmetic',
      questionText: '2 + 2 = ?',
      options: [{ key: 'a', text: '4' }, { key: 'b', text: '5' }],
      correctOptions: ['a'],
      selectionMode: 'single',
      explanation: 'Basic addition.',
      defaultMarks: 2,
      negativeMarks: 0.5,
    });
    const multipleQuestion = await Question.create({
      sectionId,
      subjectTag: 'General',
      topic: 'Logic',
      questionText: 'Select prime numbers',
      options: [{ key: 'a', text: '2' }, { key: 'b', text: '3' }, { key: 'c', text: '4' }],
      correctOptions: ['a', 'b'],
      selectionMode: 'multiple',
      explanation: '2 and 3 are prime.',
      defaultMarks: 3,
      negativeMarks: 1,
    });

    await Test.create({
      _id: testId,
      examId: new mongoose.Types.ObjectId(),
      title: 'Result selection mode test',
      type: 'full_mock',
      totalQuestions: 2,
      totalMarks: 5,
      durationMinutes: 30,
      sections: [],
      isPublished: true,
      createdBy: student.id,
    });
    await TestQuestion.create([
      { testId, questionId: singleQuestion.id, sectionId, order: 1, marks: 2 },
      { testId, questionId: multipleQuestion.id, sectionId, order: 2, marks: 3 },
    ]);
    const attempt = await Attempt.create({
      userId: student.id,
      testId,
      totalScore: 5,
      correctCount: 2,
      incorrectCount: 0,
      unattemptedCount: 0,
      timeTakenSeconds: 30,
      status: 'completed',
    });
    await AttemptAnswer.create([
      {
        attemptId: attempt.id,
        questionId: singleQuestion.id,
        selectedOptions: ['a'],
        isAttempted: true,
        isCorrect: true,
        marksObtained: 2,
        questionSnapshot: {
          questionText: singleQuestion.questionText,
          options: singleQuestion.options,
          correctOptions: singleQuestion.correctOptions,
          marks: 2,
          negativeMarks: 0.5,
          topic: singleQuestion.topic,
          subjectTag: singleQuestion.subjectTag,
          explanation: singleQuestion.explanation,
        },
      },
      {
        attemptId: attempt.id,
        questionId: multipleQuestion.id,
        selectedOptions: ['a', 'b'],
        isAttempted: true,
        isCorrect: true,
        marksObtained: 3,
        questionSnapshot: {
          questionText: multipleQuestion.questionText,
          options: multipleQuestion.options,
          correctOptions: multipleQuestion.correctOptions,
          marks: 3,
          negativeMarks: 1,
          topic: multipleQuestion.topic,
          subjectTag: multipleQuestion.subjectTag,
          explanation: multipleQuestion.explanation,
        },
      },
    ]);

    const auth = await login('student@example.com', 'Student@12345');
    const response = await request(app)
      .get(`/api/v1/attempts/${attempt.id}/result`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.review).toHaveLength(2);

    const singleReview = response.body.data.review.find((item: { questionId: string }) => item.questionId === singleQuestion.id);
    const multipleReview = response.body.data.review.find((item: { questionId: string }) => item.questionId === multipleQuestion.id);

    expect(singleReview.selectionMode).toBe('single');
    expect(multipleReview.selectionMode).toBe('multiple');
    expect(singleReview.correctOptions).toEqual(['a']);
    expect(multipleReview.correctOptions).toEqual(['a', 'b']);
    expect(singleReview.isCorrect).toBe(true);
    expect(multipleReview.isCorrect).toBe(true);
    expect(singleReview.marksObtained).toBe(2);
    expect(multipleReview.marksObtained).toBe(3);
    expect(singleReview).not.toHaveProperty('questionSnapshot');
    expect(multipleReview).not.toHaveProperty('questionSnapshot');
    expect(singleReview).not.toHaveProperty('createdAt');
    expect(multipleReview).not.toHaveProperty('updatedAt');
  });
});
