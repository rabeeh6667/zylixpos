import { Router } from 'express';
import { checkoutSale, holdSale, getHeldSales, deleteHeldSale, getSaleReceipt } from '../controllers/posController.ts';
import { authenticate } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.post('/checkout', checkoutSale);
router.post('/hold', holdSale);
router.get('/held', getHeldSales);
router.delete('/held/:id', deleteHeldSale);
router.get('/receipt/:id', getSaleReceipt);

export default router;
