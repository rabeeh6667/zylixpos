import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('OWNER', 'MANAGER'), getUsers);
router.post('/', requireRole('OWNER', 'MANAGER'), createUser);
router.patch('/:id', requireRole('OWNER', 'MANAGER'), updateUser);
router.delete('/:id', requireRole('OWNER'), deleteUser);

export default router;
