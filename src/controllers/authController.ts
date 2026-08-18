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
  return ok(res, await authService.refresh(req.body.refreshToken), 'Token refreshed');
}
export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  return ok(res, null, 'Logged out');
}
export async function me(req: Request, res: Response) {
  return ok(res, authService.toPublicUser(req.user!), 'Current user');
}
