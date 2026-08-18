import type { TokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string; role: TokenPayload['role'] };
    }
  }
}

export {};
