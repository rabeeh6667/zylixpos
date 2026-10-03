import { Router } from 'express';
import { getBusiness, updateBusiness } from '../controllers/businessController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', getBusiness);
router.put('/', requireRole('OWNER'), updateBusiness);

export default router;
