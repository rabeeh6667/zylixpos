
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required'),
  contactPerson: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().email('Invalid email').or(z.literal('')).optional().default(''),
  category: z.string().trim().optional().default('General Goods'),
  address: z.string().trim().optional().default(''),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
});

function getSupplier(id: string, businessId: string) {
  return db.prepare(
    'SELECT * FROM suppliers WHERE id = ? AND business_id = ?'
  ).get(id, businessId) as any;
}

export async function getSuppliers(req: Request, res: Response) {
  try {
    const suppliers = db.prepare(`
      SELECT * FROM suppliers
      WHERE business_id = ?
      ORDER BY created_at DESC
    `).all(req.businessId);

    return res.json({
      success: true,
      count: suppliers.length,
      suppliers,
      items: suppliers,
    });
  } catch (error) {
    console.error('[Suppliers] List failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load suppliers',
    });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const parsed = supplierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid supplier details',
      });
    }

    const data = parsed.data;
    const id = cryptoUUID();

    db.prepare(`
      INSERT INTO suppliers (
        id, business_id, name, contact_person, phone,
        email, category, address, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.businessId,
      data.name,
      data.contactPerson,
      data.phone,
      data.email,
      data.category,
      data.address,
      data.status
    );

    logAuditEvent({
      businessId: req.businessId,
      action: 'CREATE',
      entity: 'supplier',
      entityId: id,
      description: `Created supplier: ${data.name}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Supplier added successfully',
      supplier: getSupplier(id, req.businessId),
    });
  } catch (error) {
    console.error('[Suppliers] Create failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add supplier',
    });
  }
}

export async function updateSupplier(req: Request, res: Response) {
  try {
    const existing = getSupplier(String(req.params.id), req.businessId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    const parsed = supplierSchema.partial().safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return res.status(400).json({
        success: false,
        message: parsed.success
          ? 'No supplier fields provided'
          : parsed.error.issues[0]?.message || 'Invalid supplier details',
      });
    }

    const allowedColumns: Record<string, string> = {
      name: 'name',
      contactPerson: 'contact_person',
      phone: 'phone',
      email: 'email',
      category: 'category',
      address: 'address',
      status: 'status',
    };

    const fields = parsed.data as Record<string, unknown>;
    const updates = Object.entries(fields).filter(([key]) => allowedColumns[key]);

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid supplier fields provided',
      });
    }

    const setClause = updates
      .map(([key]) => `${allowedColumns[key]} = ?`)
      .join(', ');

    db.prepare(`
      UPDATE suppliers
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).run(
      ...updates.map(([, value]) => value),
      String(req.params.id),
      req.businessId
    );

    logAuditEvent({
      businessId: req.businessId,
      action: 'UPDATE',
      entity: 'supplier',
      entityId: String(req.params.id),
      description: `Updated supplier: ${existing.name}`,
    });

    return res.json({
      success: true,
      message: 'Supplier updated successfully',
      supplier: getSupplier(String(req.params.id), req.businessId),
    });
  } catch (error) {
    console.error('[Suppliers] Update failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update supplier',
    });
  }
}

export async function deleteSupplier(req: Request, res: Response) {
  try {
    const existing = getSupplier(String(req.params.id), req.businessId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    db.prepare(`
      DELETE FROM suppliers
      WHERE id = ? AND business_id = ?
    `).run(String(req.params.id), req.businessId);

    logAuditEvent({
      businessId: req.businessId,
      action: 'DELETE',
      entity: 'supplier',
      entityId: String(req.params.id),
      description: `Deleted supplier: ${existing.name}`,
    });

    return res.json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    console.error('[Suppliers] Delete failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
    });
  }
}
