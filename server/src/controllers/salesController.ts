import { Request, Response } from 'express';
import { query, queryOne } from '../db/dbAdapter.ts';

export async function getSales(req: Request, res: Response) {
  try {
    const { search, paymentMethod, startDate, endDate, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE s.business_id = ?';
    const params: any[] = [req.businessId];

    if (search) {
      whereClause += ' AND (s.invoice_number LIKE ? OR c.name LIKE ? OR u.name LIKE ?)';
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      whereClause += ' AND s.payment_method = ?';
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
      whereClause += ' AND date(s.created_at, "localtime") >= date(?)';
      params.push(String(startDate));
    }

    if (endDate) {
      whereClause += ' AND date(s.created_at, "localtime") <= date(?)';
      params.push(String(endDate));
    }

    const countRow = (await queryOne<any>(`
      SELECT COUNT(s.id) as total
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${whereClause}
    `, params)) || { total: 0 };

    const total = Number(countRow.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    const sales = await query(`
      SELECT s.*, u.name as cashier_name, c.name as customer_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return res.json({
      success: true,
      count: sales.length,
      sales,
      items: sales,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSaleById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // ENFORCE TENANT ISOLATION
    const sale = await queryOne<any>(`
      SELECT s.*, u.name as cashier_name, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ? AND s.business_id = ?
    `, [id, req.businessId]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale transaction record not found in your business.',
      });
    }

    const items = await query(`
      SELECT si.*, p.sku, p.barcode
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ? AND si.business_id = ?
    `, [id, req.businessId]);

    const payments = await query(`
      SELECT * FROM payments WHERE sale_id = ? AND business_id = ?
    `, [id, req.businessId]);

    return res.json({
      success: true,
      sale: {
        ...sale,
        items,
        payments,
      },
      items,
      payments,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
