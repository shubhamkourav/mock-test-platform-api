import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: typeof import('../src/app').app;

describe('health', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/health';
    process.env.JWT_ACCESS_SECRET = 'health-access-secret-12345';
    process.env.JWT_REFRESH_SECRET = 'health-refresh-secret-12345';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    ({ app } = await import('../src/app'));
  });

  it('returns ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
