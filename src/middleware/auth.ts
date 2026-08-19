import type { RequestHandler } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/apiError';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));

  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findOne({ _id: payload.sub, isActive: true });
    if (!user) return next(new ApiError(401, 'User is inactive or no longer exists', 'UNAUTHENTICATED'));
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired access token', 'INVALID_TOKEN'));
  }
};

export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();
  if (!header.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));

  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findOne({ _id: payload.sub, isActive: true });
    if (!user) return next(new ApiError(401, 'User is inactive or no longer exists', 'UNAUTHENTICATED'));
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired access token', 'INVALID_TOKEN'));
  }
};

export function authorize(...roles: Array<'student' | 'admin'>): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission', 'FORBIDDEN'));
    next();
  };
}
