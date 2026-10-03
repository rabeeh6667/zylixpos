import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole('OWNER', 'MANAGER'), updateSettings);

export default router;
