import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/mock-test-platform-test',
      JWT_ACCESS_SECRET: 'test-access-secret-12345',
      JWT_REFRESH_SECRET: 'test-refresh-secret-12345',
      CORS_ORIGIN: 'http://localhost:3000',
    },
  },
});
