import { Router } from 'express';
import {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
  deleteAllTenants,
  getTenantPayments,
  addTenantPayment
} from '../controllers/tenantController.ts';
import { authenticate, requirePlatformOwner } from '../middleware/authMiddleware.ts';

const router = Router();

// Enforce authentication & explicit ZYLIX Platform Owner authorization
router.use(authenticate, requirePlatformOwner);

router.get('/', getTenants);
router.get('/:id', getTenantById);
router.post('/', createTenant);
router.put('/:id', updateTenant);
router.patch('/:id/status', updateTenantStatus);
router.delete('/:id', deleteTenant);
router.delete('/', deleteAllTenants);

// Tenant Platform Revenue & Subscription Payments
router.get('/:id/payments', getTenantPayments);
router.post('/:id/payments', addTenantPayment);

export default router;
