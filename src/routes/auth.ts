import { Router } from 'express';
import { validate } from '../middleware/validate';
import { loginSchema, refreshSchema, registerSchema } from '../schemas/auth';
import * as controller from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.post('/logout', validate(refreshSchema), asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.me));
export default router;
