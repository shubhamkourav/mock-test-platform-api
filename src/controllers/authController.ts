import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { ok } from '../utils/response';

export async function register(req: Request, res: Response) {
  return ok(res, await authService.register(req.body), 'Registered', 201);
}
export async function login(req: Request, res: Response) {
  return ok(res, await authService.login(req.body.email, req.body.password), 'Logged in');
}
export async function refresh(req: Request, res: Response) {
  return ok(res, authService.refresh(req.body.refreshToken), 'Token refreshed');
}
