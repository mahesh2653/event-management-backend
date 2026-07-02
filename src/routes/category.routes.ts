import { Router } from 'express';
import { body } from 'express-validator';
import { listCategories, createCategory, deleteCategory } from '../controllers/category.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate';

const router = Router();

router.get('/', listCategories);
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [body('name').notEmpty()],
  validateRequest,
  createCategory,
);
router.delete('/:id', requireAuth, requireRole('admin'), deleteCategory);

export default router;
