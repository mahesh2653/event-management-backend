import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppDataSource } from '../data-source';
import { Session } from '../entities/Session';

export interface AuthRequest extends Request {
  user?: { userId: string; sessionId: string; role: string };
}

/**
 * Validates the JWT AND checks the session is still active in the DB.
 * This is what makes single-session-at-a-time actually enforced server-side:
 * even if an old access token hasn't expired yet, once its session row is
 * marked inactive (because of a newer login), every request with it is rejected.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or malformed Authorization header' });
    }
    const token = header.split(' ')[1];
    const payload = verifyAccessToken(token);

    const sessionRepo = AppDataSource.getRepository(Session);
    const session = await sessionRepo.findOne({ where: { id: payload.sessionId } });

    if (!session || !session.isActive) {
      return res.status(401).json({ message: 'Session has been logged out. Please log in again.' });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}
