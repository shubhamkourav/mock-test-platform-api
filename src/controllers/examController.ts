import { Request, Response } from 'express';
import * as examService from '../services/examService';
import { ok } from '../utils/response';

export async function listExams(req: Request, res: Response) { return ok(res, await examService.listExams(req.query.includeInactive === 'true' && req.user?.role === 'admin')); }
export async function getExam(req: Request, res: Response) { return ok(res, await examService.getExam(String(req.params.id), req.user?.role === 'admin')); }
export async function createExam(req: Request, res: Response) { return ok(res, await examService.createExam(req.body), 'Exam created', 201); }
export async function updateExam(req: Request, res: Response) { return ok(res, await examService.updateExam(String(req.params.id), req.body), 'Exam updated'); }
export async function listSections(req: Request, res: Response) { return ok(res, await examService.listSections(String(req.params.id), req.user?.role === 'admin')); }
export async function createSection(req: Request, res: Response) { return ok(res, await examService.createSection(String(req.params.id), req.body), 'Section created', 201); }
export async function updateSection(req: Request, res: Response) { return ok(res, await examService.updateSection(String(req.params.id), req.body), 'Section updated'); }
export async function deleteSection(req: Request, res: Response) { return ok(res, await examService.deactivateSection(String(req.params.id)), 'Section deactivated'); }
