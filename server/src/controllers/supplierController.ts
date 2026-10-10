import { Request, Response } from 'express';
import { query, queryOne, execute } from '../db/dbAdapter.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const createSupplierSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  category: z.string().optional(),
  address: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function getSuppliers(req: Request, res: Response) {
  try {
    const { search, category, status } = req.query;
    let whereClause = 'WHERE business_id = ?';
    const params: any[] = [req.businessId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      whereClause += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ? OR category LIKE ?)';
      params.push(term, term, term, term, term);
    }

    const suppliers = await query(`
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
    `, params);

    return res.json({
      success: true,
      count: suppliers.length,
      suppliers,
      items: suppliers,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSupplierById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const supplier = await queryOne('SELECT * FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }
    return res.json({ success: true, supplier });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const parseResult = createSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0]?.message || 'Validation error',
      });
    }

    const d = parseResult.data;
    const id = cryptoUUID();

    await execute(`
      INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, category, address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [
      id,
      req.businessId,
      d.name.trim(),
      d.contactPerson ? d.contactPerson.trim() : null,
      d.phone ? d.phone.trim() : null,
      d.email ? d.email.trim() : null,
      d.category ? d.category.trim() : 'General',
      d.address ? d.address.trim() : null,
    ]);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'SUPPLIER_CREATED',
      entity: 'supplier',
      entityId: id,
      metadata: { name: d.name, category: d.category },
    });

    const created = await queryOne('SELECT * FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);

    return res.status(201).json({
      success: true,
      message: 'Supplier created successfully.',
      supplier: created,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSupplier(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parseResult = updateSupplierSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0]?.message || 'Validation error',
      });
    }

    const existing = await queryOne('SELECT id FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier not found in your business.' });
    }

    const d = parseResult.data;
    const updates: string[] = [];
    const params: any[] = [];

    if (d.name !== undefined) { updates.push('name = ?'); params.push(d.name.trim()); }
    if (d.contactPerson !== undefined) { updates.push('contact_person = ?'); params.push(d.contactPerson || null); }
    if (d.phone !== undefined) { updates.push('phone = ?'); params.push(d.phone || null); }
    if (d.email !== undefined) { updates.push('email = ?'); params.push(d.email || null); }
    if (d.category !== undefined) { updates.push('category = ?'); params.push(d.category || null); }
    if (d.address !== undefined) { updates.push('address = ?'); params.push(d.address || null); }
    if (d.status !== undefined) { updates.push('status = ?'); params.push(d.status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.businessId);

    await execute(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`, params);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'SUPPLIER_UPDATED',
      entity: 'supplier',
      entityId: String(id),
      metadata: d,
    });

    const updated = await queryOne('SELECT * FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);

    return res.json({
      success: true,
      message: 'Supplier updated successfully.',
      supplier: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteSupplier(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>('SELECT * FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier not found in your business.' });
    }

    await execute('DELETE FROM suppliers WHERE id = ? AND business_id = ?', [id, req.businessId]);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'SUPPLIER_DELETED',
      entity: 'supplier',
      entityId: String(id),
      metadata: { name: existing.name },
    });

    return res.json({
      success: true,
      message: `Supplier '${existing.name}' deleted successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
