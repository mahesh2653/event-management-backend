import { Router } from 'express';
import { adminListEvents } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/events', requireAuth, requireRole('admin'), adminListEvents);

export default router;
