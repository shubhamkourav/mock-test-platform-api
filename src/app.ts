import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import authRoutes from './routes/auth';
import examRoutes from './routes/exams';
import sectionRoutes from './routes/sections';
import questionRoutes from './routes/questions';
import testRoutes from './routes/tests';
import attemptRoutes from './routes/attempts';
import { errorHandler } from './middleware/errorHandler';
import { swaggerSpec } from './docs/swagger';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(v => v.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX }));

app.get('/health', (_req, res) => res.json({ success: true, status: 'ok', service: 'mock-test-platform-api' }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/sections', sectionRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/attempts', attemptRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' }));
app.use(errorHandler);
