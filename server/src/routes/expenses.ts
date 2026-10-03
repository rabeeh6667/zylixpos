import { Router } from 'express';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  archiveExpense,
  getExpenseCategories
} from '../controllers/expenseController.ts';
import { authenticate, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authenticate);

router.get('/categories', getExpenseCategories);
router.get('/', getExpenses);
router.get('/:id', getExpenseById);

// OWNER & MANAGER permissions for modifying expenses
router.post('/', requireRole(['OWNER', 'MANAGER']), createExpense);
router.put('/:id', requireRole(['OWNER', 'MANAGER']), updateExpense);
router.delete('/:id', requireRole(['OWNER', 'MANAGER']), archiveExpense);

export default router;
