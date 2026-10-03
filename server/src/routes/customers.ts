import { Router } from 'express';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, archiveCustomer } from '../controllers/customerController.ts';
import { authenticate } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', archiveCustomer);

export default router;
