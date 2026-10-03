import { Router } from 'express';
import { getCategories, createCategory, updateCategory, archiveCategory } from '../controllers/categoryController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', requireRole('OWNER', 'MANAGER'), createCategory);
router.put('/:id', requireRole('OWNER', 'MANAGER'), updateCategory);
router.delete('/:id', requireRole('OWNER', 'MANAGER'), archiveCategory);

export default router;
