import { Router } from 'express';
import * as controller from '../controllers/questionController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { questionSchema } from '../schemas/question';

const router = Router();
router.get('/', asyncHandler(controller.listQuestions));
router.get('/:id', asyncHandler(controller.getQuestion));
router.post('/', authenticate, authorize('admin'), validate(questionSchema), asyncHandler(controller.createQuestion));
router.patch('/:id', authenticate, authorize('admin'), validate(questionSchema.partial()), asyncHandler(controller.updateQuestion));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(controller.deleteQuestion));
export default router;
