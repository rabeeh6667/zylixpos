import { Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/dbAdapter.ts';
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

const updateSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required').optional(),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email').or(z.literal('')).optional(),
  category: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

async function getSupplier(id: string, businessId: string) {
  return queryOne(
    'SELECT * FROM suppliers WHERE id = ? AND business_id = ?',
    [id, businessId]
  );
}

export async function getSuppliers(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: 'Business context missing or invalid session.',
        code: 'UNAUTHORIZED',
      });
    }

    const { search, category, status } = req.query;
    let whereClause = 'WHERE business_id = ?';
    const params: any[] = [businessId];

    if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (category && typeof category === 'string' && category.trim()) {
      whereClause += ' AND category = ?';
      params.push(category.trim());
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
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
  } catch (error) {
    console.error('[Suppliers] List failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load suppliers',
    });
  }
}

export async function getSupplierById(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: 'Business context missing or invalid session.',
        code: 'UNAUTHORIZED',
      });
    }

    const supplier = await getSupplier(String(req.params.id), businessId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    return res.json({
      success: true,
      supplier,
    });
  } catch (error) {
    console.error('[Suppliers] GetById failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve supplier',
    });
  }
}

export async function createSupplier(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: 'Business context missing or invalid session.',
        code: 'UNAUTHORIZED',
      });
    }

    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid supplier details',
      });
    }

    const data = parsed.data;
    const id = cryptoUUID();

    await execute(`
      INSERT INTO suppliers (
        id, business_id, name, contact_person, phone,
        email, category, address, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      businessId,
      data.name,
      data.contactPerson || null,
      data.phone || null,
      data.email || null,
      data.category || 'General Goods',
      data.address || null,
      data.status || 'ACTIVE',
    ]);

    await logAuditEvent({
      businessId,
      userId: req.user?.userId || null,
      action: 'CREATE',
      entity: 'supplier',
      entityId: id,
      description: `Created supplier: ${data.name}`,
    });

    const supplier = await getSupplier(id, businessId);

    return res.status(201).json({
      success: true,
      message: 'Supplier added successfully',
      supplier,
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
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: 'Business context missing or invalid session.',
        code: 'UNAUTHORIZED',
      });
    }

    const supplierId = String(req.params.id);
    const existing = await getSupplier(supplierId, businessId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    const parsed = updateSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid supplier details',
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
    const updates: [string, any][] = [];

    for (const [key, col] of Object.entries(allowedColumns)) {
      if (fields[key] !== undefined) {
        updates.push([col, fields[key] === '' && (key === 'email' || key === 'phone' || key === 'contactPerson' || key === 'address') ? null : fields[key]]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid supplier fields provided',
      });
    }

    const setClause = updates
      .map(([col]) => `${col} = ?`)
      .join(', ');

    const params = updates.map(([, val]) => val);
    params.push(supplierId, businessId);

    await execute(`
      UPDATE suppliers
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, params);

    await logAuditEvent({
      businessId,
      userId: req.user?.userId || null,
      action: 'UPDATE',
      entity: 'supplier',
      entityId: supplierId,
      description: `Updated supplier: ${existing.name}`,
    });

    const supplier = await getSupplier(supplierId, businessId);

    return res.json({
      success: true,
      message: 'Supplier updated successfully',
      supplier,
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
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: 'Business context missing or invalid session.',
        code: 'UNAUTHORIZED',
      });
    }

    const supplierId = String(req.params.id);
    const existing = await getSupplier(supplierId, businessId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    await execute(`
      DELETE FROM suppliers
      WHERE id = ? AND business_id = ?
    `, [supplierId, businessId]);

    await logAuditEvent({
      businessId,
      userId: req.user?.userId || null,
      action: 'DELETE',
      entity: 'supplier',
      entityId: supplierId,
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
