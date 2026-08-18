import { Request, Response } from 'express';
import { Exam } from '../models/Exam';
import { Section } from '../models/Section';
import { ok } from '../utils/response';
import { ApiError } from '../utils/apiError';

export async function listExams(req: Request, res: Response) {
  const filter = { isActive: req.query.includeInactive === 'true' ? { $in: [true, false] } : true };
  return ok(res, await Exam.find(filter).sort({ name: 1 }));
}
export async function getExam(req: Request, res: Response) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
  return ok(res, exam);
}
export async function createExam(req: Request, res: Response) {
  return ok(res, await Exam.create(req.body), 'Exam created', 201);
}
export async function updateExam(req: Request, res: Response) {
  const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
  return ok(res, exam, 'Exam updated');
}
export async function listSections(req: Request, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, isActive: true });
  if (!exam) throw new ApiError(404, 'Exam not found', 'EXAM_NOT_FOUND');
  return ok(res, await Section.find({ examId: exam.id, isActive: true }).sort({ order: 1 }));
}
export async function createSection(req: Request, res: Response) {
  const exam = await Exam.findOne({ _id: req.params.id, isActive: true });
  if (!exam) throw new ApiError(404, 'Exam not found', 'EXAM_NOT_FOUND');
  return ok(res, await Section.create({ ...req.body, examId: exam.id }), 'Section created', 201);
}
