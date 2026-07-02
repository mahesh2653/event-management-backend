import { Router } from 'express';
import { body } from 'express-validator';
import { login, refresh, logout, me, register } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loginRateLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validate';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  [body('username').notEmpty(), body('password').notEmpty()],
  validateRequest,
  login,
);
router.post('/refresh', [body('refreshToken').notEmpty()], validateRequest, refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.post(
  '/register',
  [
    body('name').notEmpty(),
    body('username').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  validateRequest,
  register,
);

export default router;
