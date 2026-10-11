import { Request, Response } from 'express';
import { query, queryOne } from '../db/dbAdapter.ts';

// Helper to resolve date range boundaries based on preset filter
function resolveDateRange(preset?: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (preset === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
    endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
  } else if (preset === '7days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (preset === '30days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
  } else if (preset === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (preset === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (customStart) {
    startDate = new Date(customStart);
    endDate = customEnd ? new Date(customEnd) : new Date();
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Default to last 30 days
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
  }

  return {
    startStr: startDate.toISOString().split('T')[0],
    endStr: endDate.toISOString().split('T')[0],
    startDate,
    endDate,
  };
}

export async function getSalesReport(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { preset, startDate: customStart, endDate: customEnd } = req.query;

    const { startStr, endStr } = resolveDateRange(
      String(preset || ''),
      customStart ? String(customStart) : undefined,
      customEnd ? String(customEnd) : undefined
    );

    // 1. Sales & Orders Aggregation
    const salesAgg = (await queryOne<any>(`
      SELECT
        COALESCE(SUM(grand_total), 0) as totalSales,
        COUNT(id) as totalOrders,
        COALESCE(SUM(subtotal), 0) as totalSubtotal,
        COALESCE(SUM(discount), 0) as totalDiscounts,
        COALESCE(SUM(tax), 0) as totalTax
      FROM sales
      WHERE business_id = ? AND status != 'CANCELLED'
        AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    `, [businessId, startStr, endStr])) || {};

    // 2. Total Items Sold Units
    const itemsSoldAgg = (await queryOne<any>(`
      SELECT COALESCE(SUM(si.quantity), 0) as itemsSold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      WHERE si.business_id = ? AND s.status != 'CANCELLED'
        AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
    `, [businessId, startStr, endStr])) || {};

    // 3. Expenses Aggregation
    const expAgg = (await queryOne<any>(`
      SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM expenses
      WHERE business_id = ? AND status != 'ARCHIVED'
        AND date(expense_date) >= date(?) AND date(expense_date) <= date(?)
    `, [businessId, startStr, endStr])) || {};

    // 4. Cost of Goods Sold (COGS) Calculation from Products Purchase Price
    const cogsAgg = (await queryOne<any>(`
      SELECT COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) as totalCogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED'
        AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
    `, [businessId, startStr, endStr])) || {};

    const totalSales = Number(salesAgg.totalSales || 0);
    const totalOrders = Number(salesAgg.totalOrders || 0);
    const itemsSold = Number(itemsSoldAgg.itemsSold || 0);
    const totalExpenses = Number(expAgg.totalExpenses || 0);
    const totalCogs = Number(cogsAgg.totalCogs || 0);
    const estimatedProfit = Math.max(0, totalSales - totalCogs - totalExpenses);

    // 5. Daily Breakdown Timeline for Charts
    const dailyTimeline = await query(`
      SELECT
        date(s.created_at) as sale_date,
        COALESCE(SUM(s.grand_total), 0) as daily_sales,
        COUNT(s.id) as daily_orders
      FROM sales s
      WHERE s.business_id = ? AND s.status != 'CANCELLED'
        AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
      GROUP BY date(s.created_at)
      ORDER BY date(s.created_at) ASC
    `, [businessId, startStr, endStr]);

    return res.json({
      success: true,
      period: { start: startStr, end: endStr, preset },
      summary: {
        totalSales,
        totalRevenue: totalSales,
        totalOrders,
        itemsSold,
        totalExpenses,
        totalCogs,
        estimatedProfit,
        netEstimatedProfit: estimatedProfit,
        profitMargin: totalSales > 0 ? Math.round((estimatedProfit / totalSales) * 1000) / 10 : 0,
      },
      dailyTimeline,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getProductReport(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { preset, startDate: customStart, endDate: customEnd } = req.query;

    const { startStr, endStr } = resolveDateRange(
      String(preset || ''),
      customStart ? String(customStart) : undefined,
      customEnd ? String(customEnd) : undefined
    );

    // 1. Best Selling Products
    const bestSellers = await query(`
      SELECT
        p.id, p.name, p.sku, p.category_id, c.name as category_name,
        SUM(si.quantity) as total_units_sold,
        SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED'
        AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
      GROUP BY p.id, p.name, p.sku, p.category_id, c.name
      ORDER BY total_revenue DESC, total_units_sold DESC
      LIMIT 10
    `, [businessId, startStr, endStr]);

    // 2. Slow Moving / Low Selling Products
    const slowMovers = await query(`
      SELECT p.id, p.name, p.current_stock, p.unit, COALESCE(SUM(si.quantity), 0) as units_sold
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id AND p.business_id = si.business_id
      LEFT JOIN sales s ON si.sale_id = s.id AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
      WHERE p.business_id = ? AND p.status = 'ACTIVE'
      GROUP BY p.id, p.name, p.current_stock, p.unit
      ORDER BY units_sold ASC, p.current_stock DESC
      LIMIT 10
    `, [startStr, endStr, businessId]);

    // 3. Sales By Category Breakdown
    const salesByCategory = await query(`
      SELECT
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(si.quantity) as total_units,
        SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED'
        AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `, [businessId, startStr, endStr]);

    // 4. Current Stock Valuation Summary
    const stockValuation = (await queryOne<any>(`
      SELECT
        COUNT(id) as totalProducts,
        SUM(current_stock) as totalStockUnits,
        SUM(current_stock * selling_price) as retailValuation,
        SUM(current_stock * purchase_price) as costValuation,
        SUM(CASE WHEN current_stock <= min_stock AND current_stock > 0 THEN 1 ELSE 0 END) as lowStockCount,
        SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as outOfStockCount
      FROM products
      WHERE business_id = ? AND status = 'ACTIVE'
    `, [businessId])) || {};

    return res.json({
      success: true,
      bestSellers,
      slowMovers,
      salesByCategory,
      stockValuation,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getPaymentReport(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { preset, startDate: customStart, endDate: customEnd } = req.query;

    const { startStr, endStr } = resolveDateRange(
      String(preset || ''),
      customStart ? String(customStart) : undefined,
      customEnd ? String(customEnd) : undefined
    );

    const paymentBreakdown = await query<any>(`
      SELECT
        payment_method,
        COUNT(id) as transaction_count,
        SUM(amount) as total_amount
      FROM payments
      WHERE business_id = ? AND status = 'COMPLETED'
        AND date(created_at) >= date(?) AND date(created_at) <= date(?)
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `, [businessId, startStr, endStr]);

    const totalRevenue = paymentBreakdown.reduce((sum: number, p: any) => sum + (Number(p.total_amount) || 0), 0);

    const withPercentages = paymentBreakdown.map((p: any) => ({
      ...p,
      percentage: totalRevenue > 0 ? Math.round((p.total_amount / totalRevenue) * 1000) / 10 : 0,
    }));

    return res.json({
      success: true,
      totalRevenue,
      paymentBreakdown: withPercentages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function exportReportCsv(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { type = 'sales', preset = '30days' } = req.query;
    const { startStr, endStr } = resolveDateRange(String(preset));

    let csvContent = '';
    let filename = `zylix_${type}_report_${startStr}_to_${endStr}.csv`;

    if (type === 'sales') {
      const sales = await query<any>(`
        SELECT s.invoice_number, s.created_at, c.name as customer_name, s.payment_method, s.subtotal, s.discount, s.tax, s.grand_total, s.status
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.business_id = ? AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
        ORDER BY s.created_at DESC
      `, [businessId, startStr, endStr]);

      csvContent = 'Invoice Number,Date,Customer,Payment Method,Subtotal,Discount,Tax,Grand Total,Status\n';
      sales.forEach((s: any) => {
        csvContent += `"${s.invoice_number}","${s.created_at}","${s.customer_name || 'Walk-in Guest'}","${s.payment_method}",${s.subtotal},${s.discount},${s.tax},${s.grand_total},"${s.status}"\n`;
      });
    } else if (type === 'expenses') {
      const expenses = await query<any>(`
        SELECT title, category, amount, payment_method, expense_date, description
        FROM expenses
        WHERE business_id = ? AND date(expense_date) >= date(?) AND date(expense_date) <= date(?)
        ORDER BY expense_date DESC
      `, [businessId, startStr, endStr]);

      csvContent = 'Title,Category,Amount,Payment Method,Date,Description\n';
      expenses.forEach((e: any) => {
        csvContent += `"${e.title}","${e.category}",${e.amount},"${e.payment_method}","${e.expense_date}","${e.description || ''}"\n`;
      });
    } else if (type === 'products') {
      const products = await query<any>(`
        SELECT p.name, p.sku, p.barcode, c.name as category, p.selling_price, p.purchase_price, p.current_stock, p.unit, p.status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.business_id = ?
        ORDER BY p.name ASC
      `, [businessId]);

      csvContent = 'Product Name,SKU,Barcode,Category,Selling Price,Purchase Price,Stock,Unit,Status\n';
      products.forEach((p: any) => {
        csvContent += `"${p.name}","${p.sku || ''}","${p.barcode || ''}","${p.category || ''}",${p.selling_price},${p.purchase_price},${p.current_stock},"${p.unit}","${p.status}"\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
