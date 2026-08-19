import { Router } from 'express';
import * as controller from '../controllers/testController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addTestQuestionSchema, reorderTestQuestionsSchema, testSchema, updateTestQuestionSchema } from '../schemas/test';

const router = Router();
router.get('/', asyncHandler(controller.listTests));
router.get('/:id', asyncHandler(controller.getTest));
router.post('/', authenticate, authorize('admin'), validate(testSchema), asyncHandler(controller.createTest));
router.patch('/:id', authenticate, authorize('admin'), validate(testSchema.partial()), asyncHandler(controller.updateTest));
router.post('/:id/questions', authenticate, authorize('admin'), validate(addTestQuestionSchema), asyncHandler(controller.addQuestion));
router.patch('/:id/questions/:questionId', authenticate, authorize('admin'), validate(updateTestQuestionSchema), asyncHandler(controller.updateQuestion));
router.delete('/:id/questions/:questionId', authenticate, authorize('admin'), asyncHandler(controller.deleteQuestion));
router.post('/:id/reorder', authenticate, authorize('admin'), validate(reorderTestQuestionsSchema), asyncHandler(controller.reorder));
router.post('/:id/publish', authenticate, authorize('admin'), asyncHandler(controller.publishTest));
router.post('/:id/unpublish', authenticate, authorize('admin'), asyncHandler(controller.unpublishTest));
export default router;
