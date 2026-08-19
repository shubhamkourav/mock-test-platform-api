import { Request, Response } from 'express';
import * as testService from '../services/testService';
import { ok } from '../utils/response';

export async function listTests(req: Request, res: Response) { return ok(res, await testService.listTests(req.query, req.user?.role === 'admin' && req.query.includeUnpublished === 'true')); }
export async function getTest(req: Request, res: Response) { return ok(res, await testService.getTest(req.params.id, req.user?.role === 'admin')); }
export async function createTest(req: Request, res: Response) { return ok(res, await testService.createTest(req.body, req.user!.id), 'Test created', 201); }
export async function updateTest(req: Request, res: Response) { return ok(res, await testService.updateTest(req.params.id, req.body), 'Test updated'); }
export async function addQuestion(req: Request, res: Response) { return ok(res, await testService.addQuestion(req.params.id, req.body), 'Question added', 201); }
export async function updateQuestion(req: Request, res: Response) { return ok(res, await testService.updateQuestionMapping(req.params.id, req.params.questionId, req.body), 'Test question updated'); }
export async function deleteQuestion(req: Request, res: Response) { return ok(res, await testService.deleteQuestionMapping(req.params.id, req.params.questionId), 'Test question removed'); }
export async function reorder(req: Request, res: Response) { return ok(res, await testService.reorderQuestions(req.params.id, req.body.items), 'Questions reordered'); }
export async function publishTest(req: Request, res: Response) { return ok(res, await testService.publishTest(req.params.id), 'Test published'); }
export async function unpublishTest(req: Request, res: Response) { return ok(res, await testService.unpublishTest(req.params.id), 'Test unpublished'); }
