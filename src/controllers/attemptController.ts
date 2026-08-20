import { Request, Response } from 'express';
import * as attemptService from '../services/attemptService';
import { getAttemptResult } from '../services/resultService';
import { ok } from '../utils/response';

export async function createAttempt(req: Request, res: Response) { const result = await attemptService.createAttempt(req.body.testId, req.user!.id); return ok(res, { attempt: result.attempt, questions: result.questions, resumed: result.resumed }, result.resumed ? 'Existing attempt resumed' : 'Attempt started', result.resumed ? 200 : 201); }
export async function getAttempt(req: Request, res: Response) { return ok(res, await attemptService.getAttempt(String(req.params.id), req.user!.id)); }
export async function saveAnswer(req: Request, res: Response) { return ok(res, await attemptService.saveAnswer(String(req.params.id), req.user!.id, req.body), 'Answer saved'); }
export async function submitAttempt(req: Request, res: Response) { return ok(res, await attemptService.submitAttempt(String(req.params.id), req.user!.id), 'Attempt submitted'); }
export async function result(req: Request, res: Response) { return ok(res, await getAttemptResult(String(req.params.id), req.user!.id)); }
