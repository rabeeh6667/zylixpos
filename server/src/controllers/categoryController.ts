import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
});

export async function getCategories(req: Request, res: Response) {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.status != 'ARCHIVED'
      WHERE c.business_id = ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all(req.businessId);

    return res.json({
      success: true,
      categories,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, description } = parseResult.data;

    // Check name uniqueness for current tenant
    const existing = db.prepare('SELECT id FROM categories WHERE business_id = ? AND LOWER(name) = LOWER(?)').get(req.businessId, name.trim());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A category with this name already exists in your store.',
      });
    }

    const id = cryptoUUID();
    db.prepare(`
      INSERT INTO categories (id, business_id, name, description, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `).run(id, req.businessId, name.trim(), description || null);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CATEGORY_CREATED',
      entity: 'category',
      entityId: id,
      metadata: { name },
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: { id, name: name.trim(), description, status: 'ACTIVE' },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parseResult = categorySchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const targetCat = db.prepare('SELECT * FROM categories WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!targetCat) {
      return res.status(404).json({ success: false, message: 'Category not found in your business.' });
    }

    const { name, description } = parseResult.data;

    if (name) {
      const existing = db.prepare('SELECT id FROM categories WHERE business_id = ? AND LOWER(name) = LOWER(?) AND id != ?').get(req.businessId, name.trim(), id);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Another category with this name already exists.' });
      }
    }

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).run(name ? name.trim() : null, description !== undefined ? description : null, id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CATEGORY_UPDATED',
      entity: 'category',
      entityId: id,
      metadata: parseResult.data,
    });

    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function archiveCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const targetCat = db.prepare('SELECT * FROM categories WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!targetCat) {
      return res.status(404).json({ success: false, message: 'Category not found in your business.' });
    }

    // Soft archive to preserve product linkages
    db.prepare(`UPDATE categories SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`).run(id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'CATEGORY_ARCHIVED',
      entity: 'category',
      entityId: id,
    });

    return res.json({ success: true, message: 'Category archived successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
