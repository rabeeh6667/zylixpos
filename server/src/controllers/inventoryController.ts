import { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/dbAdapter.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const stockActionSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

const stockAdjustSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  newStock: z.number().int().min(0, 'New stock quantity cannot be negative'),
  notes: z.string().min(2, 'Reason for adjustment required'),
});

export async function getInventoryTransactions(req: Request, res: Response) {
  try {
    const { productId, type, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      LEFT JOIN users u ON it.user_id = u.id
      WHERE it.business_id = ?
    `;

    const params: any[] = [req.businessId];

    if (productId) {
      baseQuery += ` AND it.product_id = ?`;
      params.push(productId);
    }

    if (type) {
      baseQuery += ` AND it.transaction_type = ?`;
      params.push(type);
    }

    const countRow = (await queryOne<any>(`SELECT COUNT(*) as total ${baseQuery}`, params)) || { total: 0 };
    const total = Number(countRow.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    const items = await query(`
      SELECT it.*, p.name as product_name, p.sku, p.barcode, p.unit, u.name as user_name
      ${baseQuery}
      ORDER BY it.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return res.json({
      success: true,
      items,
      transactions: items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function stockIn(req: Request, res: Response) {
  try {
    const parseResult = stockActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { productId, quantity, referenceId, notes } = parseResult.data;

    // Verify product belongs to tenant
    const product = await queryOne<any>('SELECT * FROM products WHERE id = ? AND business_id = ?', [productId, req.businessId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in your business.' });
    }

    const txId = cryptoUUID();
    const newStock = Number(product.current_stock) + quantity;

    await transaction(async (tx) => {
      // 1. Update product current stock
      await tx.execute(`UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`, [newStock, productId, req.businessId]);

      // 2. Insert inventory transaction record
      await tx.execute(`
        INSERT INTO inventory_transactions (id, business_id, product_id, transaction_type, quantity, reference_id, notes, user_id)
        VALUES (?, ?, ?, 'STOCK_IN', ?, ?, ?, ?)
      `, [txId, req.businessId, productId, quantity, referenceId || null, notes || 'Stock received', req.user?.userId || null]);
    });

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'STOCK_IN',
      entity: 'product',
      entityId: productId,
      description: `Added +${quantity} units to ${product.name}`,
      metadata: { productName: product.name, addedQty: quantity, newStock },
    });

    return res.json({
      success: true,
      message: `Successfully added +${quantity} units to '${product.name}'. New Stock: ${newStock}`,
      newStock,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function stockOut(req: Request, res: Response) {
  try {
    const parseResult = stockActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { productId, quantity, referenceId, notes } = parseResult.data;

    const product = await queryOne<any>('SELECT * FROM products WHERE id = ? AND business_id = ?', [productId, req.businessId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in your business.' });
    }

    const newStock = Number(product.current_stock) - quantity;

    // Check negative inventory policy
    const negSetting = await queryOne<any>("SELECT value FROM settings WHERE business_id = ? AND key = 'allow_negative_inventory'", [req.businessId]);
    const allowNegative = negSetting?.value === 'true';

    if (newStock < 0 && !allowNegative) {
      return res.status(400).json({
        success: false,
        message: `Stock removal rejected: Current stock (${product.current_stock}) is insufficient for removing ${quantity} units.`,
      });
    }

    const txId = cryptoUUID();

    await transaction(async (tx) => {
      await tx.execute(`UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`, [newStock, productId, req.businessId]);

      await tx.execute(`
        INSERT INTO inventory_transactions (id, business_id, product_id, transaction_type, quantity, reference_id, notes, user_id)
        VALUES (?, ?, ?, 'STOCK_OUT', ?, ?, ?, ?)
      `, [txId, req.businessId, productId, -quantity, referenceId || null, notes || 'Stock removed/damaged', req.user?.userId || null]);
    });

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'STOCK_OUT',
      entity: 'product',
      entityId: productId,
      description: `Removed -${quantity} units from ${product.name}`,
      metadata: { productName: product.name, removedQty: quantity, newStock },
    });

    return res.json({
      success: true,
      message: `Successfully removed -${quantity} units from '${product.name}'. New Stock: ${newStock}`,
      newStock,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adjustStock(req: Request, res: Response) {
  try {
    const parseResult = stockAdjustSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { productId, newStock, notes } = parseResult.data;

    const product = await queryOne<any>('SELECT * FROM products WHERE id = ? AND business_id = ?', [productId, req.businessId]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in your business.' });
    }

    const currentStock = Number(product.current_stock);
    const delta = newStock - currentStock;

    if (delta === 0) {
      return res.status(400).json({ success: false, message: 'New stock is identical to current stock. No adjustment made.' });
    }

    const txId = cryptoUUID();

    await transaction(async (tx) => {
      await tx.execute(`UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`, [newStock, productId, req.businessId]);

      await tx.execute(`
        INSERT INTO inventory_transactions (id, business_id, product_id, transaction_type, quantity, notes, user_id)
        VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?)
      `, [txId, req.businessId, productId, delta, notes, req.user?.userId || null]);
    });

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'STOCK_ADJUSTMENT',
      entity: 'product',
      entityId: productId,
      description: `Stock adjusted for ${product.name} (${currentStock} -> ${newStock})`,
      metadata: { productName: product.name, previousStock: currentStock, newStock, delta, notes },
    });

    return res.json({
      success: true,
      message: `Stock for '${product.name}' adjusted from ${currentStock} to ${newStock} (${delta > 0 ? '+' : ''}${delta}).`,
      newStock,
      delta,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getLowStockItems(req: Request, res: Response) {
  try {
    const lowStockItems = await query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.business_id = ? AND p.status = 'ACTIVE' AND p.current_stock <= p.min_stock
      ORDER BY p.current_stock ASC
    `, [req.businessId]);

    return res.json({
      success: true,
      count: lowStockItems.length,
      items: lowStockItems,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
