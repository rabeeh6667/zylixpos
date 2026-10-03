import { Router } from 'express';
import {
  handleCreateBackup,
  handleListBackups,
  handleDeleteBackup,
  handleRestoreBackup,
  handleDatabaseHealth
} from '../controllers/systemController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

// Database Health & Diagnostics (OWNER & MANAGER)
router.get('/database-health', requireRole('OWNER', 'MANAGER'), handleDatabaseHealth);

// Backup List (OWNER & MANAGER)
router.get('/backups', requireRole('OWNER', 'MANAGER'), handleListBackups);

// Backup Creation (OWNER ONLY)
router.post('/backup', requireRole('OWNER'), handleCreateBackup);

// Backup Deletion (OWNER ONLY)
router.delete('/backups/:id', requireRole('OWNER'), handleDeleteBackup);

// Database Restoration (OWNER ONLY)
router.post('/restore', requireRole('OWNER'), handleRestoreBackup);

export default router;
