import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export async function getCustomers(req: Request, res: Response) {
  try {
    const { search, status = 'ACTIVE', page, limit } = req.query;

    let whereClause = 'WHERE c.business_id = ?';
    const params: any[] = [req.businessId];

    if (status === 'ARCHIVED') {
      whereClause += ` AND c.status = 'ARCHIVED'`;
    } else {
      whereClause += ` AND c.status != 'ARCHIVED'`;
    }

    if (search) {
      whereClause += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`;
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    const countRow = db.prepare(`
      SELECT COUNT(c.id) as total
      FROM customers c
      ${whereClause}
    `).get(...params) as any || { total: 0 };

    const total = Number(countRow.total || 0);
    const pageNum = page ? Math.max(1, parseInt(String(page), 10) || 1) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50)) : 0;
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;

    let query = `
      SELECT c.*,
        COALESCE(SUM(s.grand_total), 0) as total_spent,
        COUNT(s.id) as total_orders,
        MAX(s.created_at) as last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.business_id = c.business_id AND s.status != 'CANCELLED'
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    const queryParams = [...params];
    if (limitNum > 0) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNum, (pageNum - 1) * limitNum);
    }

    const customers = db.prepare(query).all(...queryParams);

    return res.json({
      success: true,
      count: customers.length,
      customers,
      items: customers,
      page: pageNum,
      limit: limitNum || total,
      total,
      totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCustomerById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // ENFORCE TENANT ISOLATION
    const customer = db.prepare(`
      SELECT c.*,
        COALESCE(SUM(s.grand_total), 0) as total_spent,
        COUNT(s.id) as total_orders,
        MAX(s.created_at) as last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.business_id = c.business_id AND s.status != 'CANCELLED'
      WHERE c.id = ? AND c.business_id = ?
      GROUP BY c.id
    `).get(id, req.businessId) as any;

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found in your business tenant.',
      });
    }

    // Fetch customer's real purchase history from database sales table
    const purchases = db.prepare(`
      SELECT s.*, u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.customer_id = ? AND s.business_id = ? AND s.status != 'CANCELLED'
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all(id, req.businessId);

    // Attach items to each sale invoice in history
    const purchasesWithItems = purchases.map((sale: any) => {
      const items = db.prepare(`
        SELECT si.*
        FROM sale_items si
        WHERE si.sale_id = ? AND si.business_id = ?
      `).all(sale.id, req.businessId);
      return { ...sale, items };
    });

    return res.json({
      success: true,
      customer,
      purchaseHistory: purchasesWithItems,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const parseResult = createCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, email, phone, address, notes } = parseResult.data;
    const id = cryptoUUID();

    db.prepare(`
      INSERT INTO customers (id, business_id, name, email, phone, address, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(id, req.businessId, name.trim(), email || null, phone || null, address || null, notes || null);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CUSTOMER_CREATED',
      entity: 'customer',
      entityId: id,
      metadata: { name, email, phone },
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      customerId: id,
      customer: { id, name, email, phone, address, notes },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM customers WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found in your business.',
      });
    }

    const parseResult = updateCustomerSchema.safeParse(req.body);
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

    if (d.name !== undefined) { updates.push('name = ?'); params.push(d.name.trim()); }
    if (d.email !== undefined) { updates.push('email = ?'); params.push(d.email || null); }
    if (d.phone !== undefined) { updates.push('phone = ?'); params.push(d.phone || null); }
    if (d.address !== undefined) { updates.push('address = ?'); params.push(d.address || null); }
    if (d.notes !== undefined) { updates.push('notes = ?'); params.push(d.notes || null); }
    if (d.status !== undefined) { updates.push('status = ?'); params.push(d.status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.businessId);

    db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`).run(...params);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CUSTOMER_UPDATED',
      entity: 'customer',
      entityId: id,
      metadata: d,
    });

    return res.json({
      success: true,
      message: 'Customer updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function archiveCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM customers WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found in your business.',
      });
    }

    db.prepare(`UPDATE customers SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`).run(id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CUSTOMER_ARCHIVED',
      entity: 'customer',
      entityId: id,
    });

    return res.json({
      success: true,
      message: 'Customer archived successfully. Sales history preserved.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
