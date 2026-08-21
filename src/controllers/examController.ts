import { Request, Response } from 'express';
import * as examService from '../services/examService';
import { ok } from '../utils/response';
import { ApiError } from '../utils/apiError';

function wantsInactive(req: Request) {
  return req.query.includeInactive === 'true';
}

function assertAdminForInactive(req: Request) {
  if (wantsInactive(req) && req.user?.role !== 'admin') throw new ApiError(req.user ? 403 : 401, req.user ? 'You do not have permission' : 'Authentication required', req.user ? 'FORBIDDEN' : 'UNAUTHENTICATED');
}

export async function listExams(req: Request, res: Response) {
  assertAdminForInactive(req);
  return ok(res, await examService.listExams(wantsInactive(req)));
}
export async function getExam(req: Request, res: Response) { return ok(res, await examService.getExam(String(req.params.id), req.user?.role === 'admin')); }
export async function createExam(req: Request, res: Response) { return ok(res, await examService.createExam(req.body), 'Exam created', 201); }
export async function updateExam(req: Request, res: Response) { return ok(res, await examService.updateExam(String(req.params.id), req.body), 'Exam updated'); }
export async function listSections(req: Request, res: Response) {
  assertAdminForInactive(req);
  return ok(res, await examService.listSections(String(req.params.id), wantsInactive(req)));
}
export async function createSection(req: Request, res: Response) { return ok(res, await examService.createSection(String(req.params.id), req.body), 'Section created', 201); }
export async function updateSection(req: Request, res: Response) { return ok(res, await examService.updateSection(String(req.params.id), req.body), 'Section updated'); }
export async function deleteSection(req: Request, res: Response) { return ok(res, await examService.deactivateSection(String(req.params.id)), 'Section deactivated'); }
