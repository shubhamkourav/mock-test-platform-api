import { Router } from 'express';
import * as controller from '../controllers/attemptController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { answerSchema, createAttemptSchema } from '../schemas/attempt';

const router = Router();
router.use(authenticate);
router.post('/', validate(createAttemptSchema), asyncHandler(controller.createAttempt));
router.get('/:id', asyncHandler(controller.getAttempt));
router.post('/:id/answers', validate(answerSchema), asyncHandler(controller.saveAnswer));
router.post('/:id/submit', asyncHandler(controller.submitAttempt));
router.get('/:id/result', asyncHandler(controller.result));
export default router;
