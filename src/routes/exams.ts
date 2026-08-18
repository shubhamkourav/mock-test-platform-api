import { Router } from 'express';
import * as controller from '../controllers/examController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { examSchema, sectionSchema } from '../schemas/exam';

const router = Router();
router.get('/', asyncHandler(controller.listExams));
router.get('/:id', asyncHandler(controller.getExam));
router.get('/:id/sections', asyncHandler(controller.listSections));
router.post('/', authenticate, authorize('admin'), validate(examSchema), asyncHandler(controller.createExam));
router.patch('/:id', authenticate, authorize('admin'), validate(examSchema.partial()), asyncHandler(controller.updateExam));
router.post('/:id/sections', authenticate, authorize('admin'), validate(sectionSchema.omit({ examId: true }).extend({ examId: sectionSchema.shape.examId })), asyncHandler(controller.createSection));
export default router;
