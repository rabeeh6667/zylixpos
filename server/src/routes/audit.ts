import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('OWNER', 'MANAGER'), getAuditLogs);

export default router;
