import { Router } from 'express';
import { register, login, getCurrentUser, logout } from '../controllers/authController.ts';
import { authenticate } from '../middleware/authMiddleware.ts';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

export default router;
