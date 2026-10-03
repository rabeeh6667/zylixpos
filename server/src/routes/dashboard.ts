import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.ts';
import { authenticate } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);

export default router;
