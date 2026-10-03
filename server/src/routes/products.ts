import { Router } from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/productController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', requireRole('OWNER', 'MANAGER'), createProduct);
router.put('/:id', requireRole('OWNER', 'MANAGER'), updateProduct);
router.delete('/:id', requireRole('OWNER', 'MANAGER'), deleteProduct);

export default router;
