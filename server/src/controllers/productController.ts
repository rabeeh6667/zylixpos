import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(2, 'Product name required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0, 'Selling price must be at least 0'),
  taxPercentage: z.number().min(0).optional(),
  currentStock: z.number().int().optional(),
  minimumStock: z.number().int().optional(),
  unit: z.string().optional(),
  categoryId: z.string().optional(),
});

const updateProductSchema = createProductSchema.partial();

export async function getProducts(req: Request, res: Response) {
  try {
    const { search, categoryId, stockStatus, sortBy = 'name', sortOrder = 'ASC', page, limit } = req.query;

    let whereClause = 'WHERE p.business_id = ?';
    const params: any[] = [req.businessId];

    // Status filter
    if (stockStatus === 'archived') {
      whereClause += ` AND p.status = 'ARCHIVED'`;
    } else {
      whereClause += ` AND p.status != 'ARCHIVED'`;
    }

    // Category Filter
    if (categoryId) {
      whereClause += ` AND p.category_id = ?`;
      params.push(categoryId);
    }

    // Search query
    if (search) {
      whereClause += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)`;
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term, term);
    }

    // Stock status filters
    if (stockStatus === 'low_stock') {
      whereClause += ` AND p.current_stock > 0 AND p.current_stock <= p.min_stock`;
    } else if (stockStatus === 'out_of_stock') {
      whereClause += ` AND p.current_stock <= 0`;
    } else if (stockStatus === 'in_stock') {
      whereClause += ` AND p.current_stock > p.min_stock`;
    }

    // Sorting
    const validSortFields = ['name', 'selling_price', 'current_stock', 'created_at'];
    const safeSortBy = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'name';
    const safeOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countRow = db.prepare(`
      SELECT COUNT(p.id) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `).get(...params) as any || { total: 0 };

    const total = Number(countRow.total || 0);
    const pageNum = page ? Math.max(1, parseInt(String(page), 10) || 1) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50)) : 0;
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.${safeSortBy} ${safeOrder}
    `;

    const queryParams = [...params];
    if (limitNum > 0) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNum, (pageNum - 1) * limitNum);
    }

    const products = db.prepare(query).all(...queryParams);

    return res.json({
      success: true,
      count: products.length,
      products,
      items: products,
      page: pageNum,
      limit: limitNum || total,
      total,
      totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // ENFORCE TENANT ISOLATION
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.business_id = ?
    `).get(id, req.businessId) as any;

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your business.',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    // Fetch product stock transaction history
    const history = db.prepare(`
      SELECT it.*, u.name as user_name
      FROM inventory_transactions it
      LEFT JOIN users u ON it.user_id = u.id
      WHERE it.product_id = ? AND it.business_id = ?
      ORDER BY it.created_at DESC
      LIMIT 50
    `).all(id, req.businessId);

    return res.json({
      success: true,
      product,
      inventoryHistory: history,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    const body = {
      name: req.body.name,
      sku: req.body.sku,
      barcode: req.body.barcode,
      brand: req.body.brand,
      description: req.body.description,
      purchasePrice: req.body.purchasePrice ?? req.body.costPrice ?? 0,
      sellingPrice: req.body.sellingPrice ?? req.body.price ?? 0,
      taxPercentage: req.body.taxPercentage ?? req.body.taxRate ?? 0,
      currentStock: req.body.currentStock ?? req.body.stockQuantity ?? 0,
      minimumStock: req.body.minimumStock ?? req.body.minStockLevel ?? 5,
      unit: req.body.unit,
      categoryId: req.body.categoryId,
    };

    const parseResult = createProductSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error?.issues?.map((e) => e.message) || parseResult.error?.errors?.map((e) => e.message) || ['Invalid product payload'];
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessages,
      });
    }

    const d = parseResult.data;

    // Check Barcode Uniqueness per business
    if (d.barcode && d.barcode.trim()) {
      const existingBarcode = db.prepare('SELECT id FROM products WHERE business_id = ? AND barcode = ? AND status != \'ARCHIVED\'').get(req.businessId, d.barcode.trim());
      if (existingBarcode) {
        return res.status(409).json({
          success: false,
          message: `Barcode '${d.barcode}' is already assigned to another product in your store.`,
        });
      }
    }

    // Check SKU Uniqueness per business
    if (d.sku && d.sku.trim()) {
      const existingSku = db.prepare('SELECT id FROM products WHERE business_id = ? AND sku = ? AND status != \'ARCHIVED\'').get(req.businessId, d.sku.trim());
      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `SKU '${d.sku}' is already assigned to another product in your store.`,
        });
      }
    }

    const id = cryptoUUID();
    const initStock = d.currentStock || 0;

    db.transaction(() => {
      // 1. Insert product
      db.prepare(`
        INSERT INTO products (
          id, business_id, category_id, name, sku, barcode, brand, description,
          purchase_price, selling_price, tax_percentage, current_stock, min_stock, unit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(
        id,
        req.businessId,
        d.categoryId || null,
        d.name.trim(),
        d.sku ? d.sku.trim() : null,
        d.barcode ? d.barcode.trim() : null,
        d.brand ? d.brand.trim() : null,
        d.description || null,
        d.purchasePrice || 0,
        d.sellingPrice,
        d.taxPercentage || 0,
        initStock,
        d.minimumStock !== undefined ? d.minimumStock : 5,
        d.unit || 'pcs'
      );

      // 2. Initial stock inventory transaction if stock > 0
      if (initStock > 0) {
        db.prepare(`
          INSERT INTO inventory_transactions (id, business_id, product_id, transaction_type, quantity, notes, user_id)
          VALUES (?, ?, ?, 'STOCK_IN', ?, 'Initial product stock creation', ?)
        `).run(cryptoUUID(), req.businessId, id, initStock, req.user?.userId || null);
      }
    })();

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'PRODUCT_CREATED',
      entity: 'product',
      entityId: id,
      metadata: { name: d.name, sellingPrice: d.sellingPrice, barcode: d.barcode, initialStock: initStock },
    });

    const newProd = db.prepare('SELECT p.*, p.current_stock as stock, p.min_stock as minStock FROM products p WHERE p.id = ?').get(id);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      productId: id,
      product: newProd,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // ENFORCE TENANT ISOLATION
    const existing = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(id, req.businessId) as any;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your business.',
      });
    }

    const parseResult = updateProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const d = parseResult.data;

    // Validate unique barcode
    if (d.barcode && d.barcode.trim() !== existing.barcode) {
      const dupBarcode = db.prepare('SELECT id FROM products WHERE business_id = ? AND barcode = ? AND id != ? AND status != \'ARCHIVED\'').get(req.businessId, d.barcode.trim(), id);
      if (dupBarcode) {
        return res.status(409).json({
          success: false,
          message: `Barcode '${d.barcode}' is already assigned to another product in your store.`,
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (d.name !== undefined) { updates.push('name = ?'); params.push(d.name.trim()); }
    if (d.sku !== undefined) { updates.push('sku = ?'); params.push(d.sku ? d.sku.trim() : null); }
    if (d.barcode !== undefined) { updates.push('barcode = ?'); params.push(d.barcode ? d.barcode.trim() : null); }
    if (d.brand !== undefined) { updates.push('brand = ?'); params.push(d.brand ? d.brand.trim() : null); }
    if (d.description !== undefined) { updates.push('description = ?'); params.push(d.description || null); }
    if (d.purchasePrice !== undefined) { updates.push('purchase_price = ?'); params.push(d.purchasePrice); }
    if (d.sellingPrice !== undefined) { updates.push('selling_price = ?'); params.push(d.sellingPrice); }
    if (d.taxPercentage !== undefined) { updates.push('tax_percentage = ?'); params.push(d.taxPercentage); }
    if (d.minimumStock !== undefined) { updates.push('min_stock = ?'); params.push(d.minimumStock); }
    if (d.unit !== undefined) { updates.push('unit = ?'); params.push(d.unit); }
    if (d.categoryId !== undefined) { updates.push('category_id = ?'); params.push(d.categoryId || null); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.businessId);

    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`).run(...params);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'PRODUCT_UPDATED',
      entity: 'product',
      entityId: id,
      metadata: d,
    });

    return res.json({
      success: true,
      message: 'Product updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // ENFORCE TENANT ISOLATION
    const existing = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(id, req.businessId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in your business.',
      });
    }

    // Soft archive product to preserve inventory history and sales reports
    db.prepare(`UPDATE products SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`).run(id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'PRODUCT_ARCHIVED',
      entity: 'product',
      entityId: id,
    });

    return res.json({
      success: true,
      message: 'Product archived successfully. Historical transaction logs preserved.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
