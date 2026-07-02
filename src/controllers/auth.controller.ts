import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { emitForceLogout } from '../socket/socket';
import { AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

const userRepo = () => AppDataSource.getRepository(User);
const sessionRepo = () => AppDataSource.getRepository(Session);

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseBrowser(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Safari';
  return 'Unknown';
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  const user = await userRepo()
    .createQueryBuilder('user')
    .addSelect('user.password')
    .where('user.username = :username', { username })
    .getOne();

  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.status !== 'active') return res.status(403).json({ message: `Account is ${user.status}` });

  const valid = await comparePassword(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  // ---- Single session enforcement ----
  // Invalidate any previously active session(s) for this user BEFORE creating the new one.
  const previousSessions = await sessionRepo().find({ where: { userId: user.id, isActive: true } });

  const browser = parseBrowser(req.headers['user-agent']);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;

  const newSession = sessionRepo().create({
    userId: user.id,
    refreshTokenHash: '', // filled in after signing (needs sessionId)
    browser,
    deviceInfo: req.headers['user-agent'] as string,
    ipAddress: ip,
    isActive: true,
  });
  await sessionRepo().save(newSession);

  const accessToken = signAccessToken({ userId: user.id, sessionId: newSession.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, sessionId: newSession.id });
  newSession.refreshTokenHash = hashToken(refreshToken);
  await sessionRepo().save(newSession);

  if (previousSessions.length) {
    await sessionRepo()
      .createQueryBuilder()
      .update(Session)
      .set({ isActive: false, revokedAt: new Date() })
      .where('id IN (:...ids)', { ids: previousSessions.map((s) => s.id) })
      .execute();

    // Real-time: tell the OLD browser tab(s) to log out immediately.
    emitForceLogout(user.id, newSession.id);
  }

  user.lastLoginAt = new Date();
  user.lastLoginBrowser = browser;
  await userRepo().save(user);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
    },
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken is required' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await sessionRepo().findOne({ where: { id: payload.sessionId } });

    if (!session || !session.isActive) {
      return res.status(401).json({ message: 'Session is no longer active' });
    }
    if (session.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ message: 'Refresh token mismatch' });
    }

    const user = await userRepo().findOne({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const accessToken = signAccessToken({ userId: user.id, sessionId: session.id, role: user.role });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  await sessionRepo().update(
    { id: req.user.sessionId },
    { isActive: false, revokedAt: new Date() },
  );
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await userRepo().findOne({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
}

// Convenience seeding-friendly signup (optional; admin-created users in real usage)
export async function register(req: Request, res: Response) {
  const { name, username, email, password, timezone } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ message: 'name, username, email, password are required' });
  }
  const existing = await userRepo().findOne({ where: [{ username }, { email }] });
  if (existing) return res.status(409).json({ message: 'Username or email already in use' });

  const user = userRepo().create({
    name,
    username,
    email,
    password: await hashPassword(password),
    timezone: timezone || 'UTC',
  });
  await userRepo().save(user);
  res.status(201).json({ message: 'User created', userId: user.id });
}
