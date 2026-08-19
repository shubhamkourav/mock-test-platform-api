import { Router } from 'express';
import * as controller from '../controllers/examController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sectionSchema } from '../schemas/exam';

const router = Router();
router.patch('/:id', authenticate, authorize('admin'), validate(sectionSchema.partial().omit({ examId: true })), asyncHandler(controller.updateSection));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(controller.deleteSection));
export default router;
