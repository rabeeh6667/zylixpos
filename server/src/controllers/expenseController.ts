import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

import { createNotification } from '../utils/notificationLogger.ts';

const createExpenseSchema = z.object({
  title: z.string().min(2, 'Expense title required'),
  categoryId: z.string().optional(),
  category: z.string().min(2, 'Expense category required'),
  amount: z.number().min(0.01, 'Expense amount must be greater than 0'),
  description: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']).default('CASH'),
  expenseDate: z.string().optional(),
});

const updateExpenseSchema = createExpenseSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export async function getExpenses(req: Request, res: Response) {
  try {
    const { search, categoryId, category, paymentMethod, startDate, endDate, status = 'ACTIVE', page, limit } = req.query;

    let whereClause = 'WHERE e.business_id = ?';
    const params: any[] = [req.businessId];

    if (status === 'ARCHIVED') {
      whereClause += ` AND e.status = 'ARCHIVED'`;
    } else {
      whereClause += ` AND e.status != 'ARCHIVED'`;
    }

    if (categoryId) {
      whereClause += ` AND e.category_id = ?`;
      params.push(categoryId);
    }

    if (category) {
      whereClause += ` AND e.category = ?`;
      params.push(category);
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      whereClause += ` AND e.payment_method = ?`;
      params.push(paymentMethod);
    }

    if (startDate && endDate && String(startDate) > String(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'startDate cannot be after endDate.',
        code: 'VALIDATION_ERROR',
      });
    }

    if (startDate) {
      whereClause += ' AND date(e.expense_date, "localtime") >= date(?)';
      params.push(String(startDate));
    }

    if (endDate) {
      whereClause += ' AND date(e.expense_date, "localtime") <= date(?)';
      params.push(String(endDate));
    }

    if (search) {
      whereClause += ` AND (e.title LIKE ? OR e.description LIKE ? OR e.category LIKE ?)`;
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    const countRow = db.prepare(`
      SELECT COUNT(e.id) as total, COALESCE(SUM(e.amount), 0) as totalAmount
      FROM expenses e
      ${whereClause}
    `).get(...params) as any || { total: 0, totalAmount: 0 };

    const total = Number(countRow.total || 0);
    const totalAmount = Number(countRow.totalAmount || 0);
    const pageNum = page ? Math.max(1, parseInt(String(page), 10) || 1) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50)) : 0;
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;

    let query = `
      SELECT e.*, ec.name as category_name, u.name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;

    const queryParams = [...params];
    if (limitNum > 0) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNum, (pageNum - 1) * limitNum);
    }

    const expenses = db.prepare(query).all(...queryParams);

    return res.json({
      success: true,
      count: expenses.length,
      totalAmount,
      expenses,
      items: expenses,
      page: pageNum,
      limit: limitNum || total,
      total,
      totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getExpenseById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const expense = db.prepare(`
      SELECT e.*, ec.name as category_name, u.name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ? AND e.business_id = ?
    `).get(id, req.businessId);

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found in your business.' });
    }

    return res.json({
      success: true,
      expense,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createExpense(req: Request, res: Response) {
  try {
    const parseResult = createExpenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { title, categoryId, category, amount, description, paymentMethod, expenseDate } = parseResult.data;
    const id = cryptoUUID();
    const dateVal = expenseDate || new Date().toISOString();

    db.prepare(`
      INSERT INTO expenses (
        id, business_id, user_id, title, category, category_id, amount, description, payment_method, expense_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      id,
      req.businessId,
      req.user?.userId || null,
      title.trim(),
      category.trim(),
      categoryId || null,
      amount,
      description || null,
      paymentMethod,
      dateVal
    );

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'EXPENSE_CREATED',
      entity: 'expense',
      entityId: id,
      metadata: { title, amount, category, paymentMethod },
    });

    createNotification({
      businessId: req.businessId!,
      userId: req.user?.userId,
      type: 'EXPENSE_RECORDED',
      title: 'New Expense Recorded',
      message: `${title} (₹${amount}) recorded under ${category}.`,
      entityType: 'expense',
      entityId: id,
    });

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully.',
      expenseId: id,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateExpense(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    const parseResult = updateExpenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const d = parseResult.data;
    const updates: string[] = [];
    const params: any[] = [];

    if (d.title !== undefined) { updates.push('title = ?'); params.push(d.title.trim()); }
    if (d.category !== undefined) { updates.push('category = ?'); params.push(d.category.trim()); }
    if (d.categoryId !== undefined) { updates.push('category_id = ?'); params.push(d.categoryId || null); }
    if (d.amount !== undefined) { updates.push('amount = ?'); params.push(d.amount); }
    if (d.description !== undefined) { updates.push('description = ?'); params.push(d.description || null); }
    if (d.paymentMethod !== undefined) { updates.push('payment_method = ?'); params.push(d.paymentMethod); }
    if (d.expenseDate !== undefined) { updates.push('expense_date = ?'); params.push(d.expenseDate); }
    if (d.status !== undefined) { updates.push('status = ?'); params.push(d.status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.businessId);

    db.prepare(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`).run(...params);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'EXPENSE_UPDATED',
      entity: 'expense',
      entityId: id,
      metadata: d,
    });

    return res.json({
      success: true,
      message: 'Expense updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function archiveExpense(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    db.prepare(`UPDATE expenses SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`).run(id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'EXPENSE_ARCHIVED',
      entity: 'expense',
      entityId: id,
    });

    return res.json({
      success: true,
      message: 'Expense archived successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Expense Categories
export async function getExpenseCategories(req: Request, res: Response) {
  try {
    const categories = db.prepare(`
      SELECT * FROM expense_categories
      WHERE business_id = ? AND status = 'ACTIVE'
      ORDER BY name ASC
    `).all(req.businessId);

    // If no categories seeded for business yet, return default list
    const defaults = ['Rent', 'Electricity', 'Salary', 'Transport', 'Maintenance', 'Supplies', 'Other'];

    return res.json({
      success: true,
      categories: categories.length > 0 ? categories : defaults.map(name => ({ id: name.toLowerCase(), name })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
