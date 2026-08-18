import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { ApiError } from '../utils/apiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

export async function register(input: {
  name: string; email: string; phone?: string; password: string; role?: 'student' | 'admin';
}) {
  const exists = await User.findOne({ email: input.email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered', 'EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    passwordHash,
    role: input.role ?? 'student',
  });

  return issueTokens(user.id, user.role);
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  return issueTokens(user.id, user.role);
}

function issueTokens(id: string, role: 'student' | 'admin') {
  return {
    accessToken: signAccessToken({ sub: id, role }),
    refreshToken: signRefreshToken({ sub: id, role }),
  };
}

export function refresh(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    return issueTokens(payload.sub, payload.role);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }
}
