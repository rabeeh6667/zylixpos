import { Router } from 'express';
import { getSales, getSaleById } from '../controllers/salesController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('OWNER', 'MANAGER'), getSales);
router.get('/:id', requireRole('OWNER', 'MANAGER'), getSaleById);

export default router;
