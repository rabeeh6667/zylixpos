import { Router } from 'express';
import {
  getSalesReport,
  getProductReport,
  getPaymentReport,
  exportReportCsv
} from '../controllers/reportController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

// Reports restricted to OWNER and MANAGER roles
router.get('/sales', requireRole(['OWNER', 'MANAGER']), getSalesReport);
router.get('/products', requireRole(['OWNER', 'MANAGER']), getProductReport);
router.get('/payments', requireRole(['OWNER', 'MANAGER']), getPaymentReport);
router.get('/export', requireRole(['OWNER', 'MANAGER']), exportReportCsv);

export default router;
