import { Request, Response } from 'express';
import * as questionService from '../services/questionService';
import { ok } from '../utils/response';

export async function listQuestions(req: Request, res: Response) { return ok(res, await questionService.listQuestions(req.query)); }
export async function getQuestion(req: Request, res: Response) { return ok(res, await questionService.getQuestion(String(req.params.id), req.user?.role === 'admin')); }
export async function createQuestion(req: Request, res: Response) { return ok(res, await questionService.createQuestion(req.body), 'Question created', 201); }
export async function updateQuestion(req: Request, res: Response) { return ok(res, await questionService.updateQuestion(String(req.params.id), req.body), 'Question updated'); }
export async function deleteQuestion(req: Request, res: Response) { return ok(res, await questionService.deactivateQuestion(String(req.params.id)), 'Question deactivated'); }
