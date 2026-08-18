import { Router } from 'express';
import { validate } from '../middleware/validate';
import { loginSchema, refreshSchema, registerSchema } from '../schemas/auth';
import * as controller from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
export default router;
