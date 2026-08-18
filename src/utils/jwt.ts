import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type TokenType = 'access' | 'refresh';
export type TokenPayload = { sub: string; role: 'student' | 'admin'; jti: string; type: TokenType };

export function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: Omit<TokenPayload, 'jti' | 'type'>) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID(), type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: Omit<TokenPayload, 'jti' | 'type'>) {
  return jwt.sign({ ...payload, jti: crypto.randomUUID(), type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function verify(token: string, secret: string, type: TokenType): TokenPayload {
  const payload = jwt.verify(token, secret) as Partial<TokenPayload>;
  if (!payload.sub || !payload.jti || payload.type !== type || !payload.role) throw new Error('Invalid token payload');
  return payload as TokenPayload;
}

export function verifyAccessToken(token: string) {
  return verify(token, env.JWT_ACCESS_SECRET, 'access');
}

export function verifyRefreshToken(token: string) {
  return verify(token, env.JWT_REFRESH_SECRET, 'refresh');
}

export function getTokenExpiry(token: string) {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) throw new Error('Token expiry missing');
  return new Date(decoded.exp * 1000);
}
