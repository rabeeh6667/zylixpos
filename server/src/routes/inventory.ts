import { Router } from 'express';
import { getInventoryTransactions, stockIn, stockOut, adjustStock, getLowStockItems } from '../controllers/inventoryController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/transactions', getInventoryTransactions);
router.get('/low-stock', getLowStockItems);

router.post('/stock-in', requireRole('OWNER', 'MANAGER'), stockIn);
router.post('/stock-out', requireRole('OWNER', 'MANAGER'), stockOut);
router.post('/adjust', requireRole('OWNER', 'MANAGER'), adjustStock);

export default router;
