import { Router } from 'express';
import * as controller from '../controllers/testController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addTestQuestionSchema, testSchema } from '../schemas/test';

const router = Router();
router.get('/', asyncHandler(controller.listTests));
router.get('/:id', asyncHandler(controller.getTest));
router.post('/', authenticate, authorize('admin'), validate(testSchema), asyncHandler(controller.createTest));
router.post('/:id/questions', authenticate, authorize('admin'), validate(addTestQuestionSchema), asyncHandler(controller.addQuestion));
router.post('/:id/publish', authenticate, authorize('admin'), asyncHandler(controller.publishTest));
export default router;
