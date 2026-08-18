import bcrypt from 'bcryptjs';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { ApiError } from '../utils/apiError';
import { getTokenExpiry, hashRefreshToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

type UserIdentity = { id: string; name: string; email: string; role: 'student' | 'admin' };
function toIdentity(user: { _id: unknown; name: string; email: string; role: 'student' | 'admin' }): UserIdentity { return { id: String(user._id), name: user.name, email: user.email, role: user.role }; }
function publicUser(user: UserIdentity) { return user; }
async function issueTokens(user: UserIdentity) {
  const payload = { sub: user.id, role: user.role }; const accessToken = signAccessToken(payload); const refreshToken = signRefreshToken(payload); const refreshPayload = verifyRefreshToken(refreshToken);
  await RefreshToken.create({ userId: user.id, jti: refreshPayload.jti, tokenHash: hashRefreshToken(refreshToken), expiresAt: getTokenExpiry(refreshToken) }); return { accessToken, refreshToken };
}
export async function register(input: { name: string; email: string; phone?: string; password: string }) {
  const exists = await User.findOne({ email: input.email.toLowerCase() }); if (exists) throw new ApiError(409, 'Email already registered', 'EMAIL_EXISTS'); const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), phone: input.phone, passwordHash, role: 'student' }); const identity = toIdentity(user); return { ...(await issueTokens(identity)), user: publicUser(identity) };
}
export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash'); if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'); const identity = toIdentity(user); return { ...(await issueTokens(identity)), user: publicUser(identity) };
}
export async function refresh(refreshToken: string) {
  try { const payload = verifyRefreshToken(refreshToken); const stored = await RefreshToken.findOneAndUpdate({ userId: payload.sub, jti: payload.jti, tokenHash: hashRefreshToken(refreshToken), revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date() } }, { new: true }); if (!stored) throw new Error('Refresh token revoked or expired'); const user = await User.findById(payload.sub); if (!user || !user.isActive) throw new Error('User inactive'); const identity = toIdentity(user); return { ...(await issueTokens(identity)), user: publicUser(identity) }; } catch { throw new ApiError(401, 'Invalid, expired, or revoked refresh token', 'INVALID_REFRESH_TOKEN'); }
}
export async function logout(refreshToken: string) { try { const payload = verifyRefreshToken(refreshToken); await RefreshToken.updateOne({ jti: payload.jti, userId: payload.sub, tokenHash: hashRefreshToken(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } }); } catch { /* Logout is idempotent. */ } }
export function toPublicUser(user: UserIdentity) { return publicUser(user); }
