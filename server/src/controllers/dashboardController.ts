import { Request, Response } from 'express';
import { db } from '../db/index.ts';

// Helper to format Date object as local YYYY-MM-DD string
function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to resolve date range boundaries based on preset filter
function resolveDateRange(preset?: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  let label = 'Today';

  const p = (preset || 'today').toLowerCase();

  if (p === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    label = 'Today';
  } else if (p === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
    endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    label = 'Yesterday';
  } else if (p === '7days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    label = 'Last 7 Days';
  } else if (p === '30days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    label = 'Last 30 Days';
  } else if (p === 'this_month' || p === 'this-month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    label = 'This Month';
  } else if (p === 'last_month' || p === 'last-month' || p === 'prev_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    label = 'Previous Month';
  } else if (customStart) {
    startDate = new Date(customStart);
    endDate = customEnd ? new Date(customEnd) : new Date();
    endDate.setHours(23, 59, 59, 999);
    label = `${formatDateString(startDate)} to ${formatDateString(endDate)}`;
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    label = 'Today';
  }

  const startStr = formatDateString(startDate);
  const endStr = formatDateString(endDate);

  // Calculate equivalent previous period date range for growth comparison
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  const prevStartStr = formatDateString(prevStartDate);
  const prevEndStr = formatDateString(prevEndDate);

  return {
    startStr,
    endStr,
    prevStartStr,
    prevEndStr,
    label,
    startDate,
    endDate,
  };
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { preset, startDate: customStart, endDate: customEnd } = req.query;

    const { startStr, endStr, prevStartStr, prevEndStr, label } = resolveDateRange(
      preset ? String(preset) : undefined,
      customStart ? String(customStart) : undefined,
      customEnd ? String(customEnd) : undefined
    );

    // 1. Current Period Sales Revenue & Orders count (using localtime in SQLite)
    const salesRow = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as totalSales, COUNT(id) as totalOrders
      FROM sales
      WHERE business_id = ? AND status != 'CANCELLED' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, startStr, endStr) as any || { totalSales: 0, totalOrders: 0 };

    // 2. Current Period Items Sold
    const productsSoldRow = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) as productsSold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      WHERE si.business_id = ? AND s.status != 'CANCELLED' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, startStr, endStr) as any || { productsSold: 0 };

    // 3. Current Period Expenses
    const expensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM expenses
      WHERE business_id = ? AND status != 'ARCHIVED' AND date(expense_date, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, startStr, endStr) as any || { totalExpenses: 0 };

    // 4. Current Period Cost of Goods Sold (COGS)
    const cogsRow = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) as totalCogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, startStr, endStr) as any || { totalCogs: 0 };

    // 5. New Customers Registered in Period
    const newCustomersRow = db.prepare(`
      SELECT COUNT(id) as newCustomers
      FROM customers
      WHERE business_id = ? AND status != 'ARCHIVED' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, startStr, endStr) as any || { newCustomers: 0 };

    // Financial Metrics
    const totalSales = Number(salesRow.totalSales || 0);
    const totalOrders = Number(salesRow.totalOrders || 0);
    const productsSold = Number(productsSoldRow.productsSold || 0);
    const totalExpenses = Number(expensesRow.totalExpenses || 0);
    const cogs = Number(cogsRow.totalCogs || 0);
    const netProfit = Math.max(0, totalSales - cogs - totalExpenses);
    const newCustomers = Number(newCustomersRow.newCustomers || 0);

    // 6. Previous Period Metrics for Dynamic Comparison Percentages
    const prevSalesRow = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as prevSales, COUNT(id) as prevOrders
      FROM sales
      WHERE business_id = ? AND status != 'CANCELLED' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, prevStartStr, prevEndStr) as any || { prevSales: 0, prevOrders: 0 };

    const prevExpensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as prevExpenses
      FROM expenses
      WHERE business_id = ? AND status != 'ARCHIVED' AND date(expense_date, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, prevStartStr, prevEndStr) as any || { prevExpenses: 0 };

    const prevCogsRow = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 0) as prevCogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, prevStartStr, prevEndStr) as any || { prevCogs: 0 };

    const prevCustomersRow = db.prepare(`
      SELECT COUNT(id) as prevCustomers
      FROM customers
      WHERE business_id = ? AND status != 'ARCHIVED' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
    `).get(businessId, prevStartStr, prevEndStr) as any || { prevCustomers: 0 };

    const prevSales = Number(prevSalesRow.prevSales || 0);
    const prevOrders = Number(prevSalesRow.prevOrders || 0);
    const prevCustomers = Number(prevCustomersRow.prevCustomers || 0);
    const prevNetProfit = Math.max(0, prevSales - Number(prevCogsRow.prevCogs || 0) - Number(prevExpensesRow.prevExpenses || 0));

    // Dynamic Comparison Function (returns percentage change or null if no previous data)
    const calcGrowth = (current: number, prev: number): number | null => {
      if (prev > 0) {
        return Number((((current - prev) / prev) * 100).toFixed(1));
      }
      return null;
    };

    // Low stock and total catalog counts
    const lowStockRow = db.prepare(`
      SELECT COUNT(id) as lowStockCount
      FROM products
      WHERE business_id = ? AND current_stock <= min_stock AND status = 'ACTIVE'
    `).get(businessId) as any || { lowStockCount: 0 };

    const totalProductsRow = db.prepare(`
      SELECT COUNT(id) as totalProducts
      FROM products
      WHERE business_id = ? AND status = 'ACTIVE'
    `).get(businessId) as any || { totalProducts: 0 };

    const totalCustomersRow = db.prepare(`
      SELECT COUNT(id) as totalCustomers
      FROM customers
      WHERE business_id = ? AND status != 'ARCHIVED'
    `).get(businessId) as any || { totalCustomers: 0 };

    // 7. Sales Over Time (Chart Data) for Period
    const salesGrouped = db.prepare(`
      SELECT
        date(created_at, 'localtime') as date,
        COALESCE(SUM(grand_total), 0) as amount
      FROM sales
      WHERE business_id = ? AND status != 'CANCELLED' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY date(created_at, 'localtime')
      ORDER BY date(created_at, 'localtime') ASC
    `).all(businessId, startStr, endStr) as any[];

    // Map sales to fill zero-value days in range
    const salesMap = new Map<string, number>();
    salesGrouped.forEach((row) => salesMap.set(row.date, row.amount));

    const salesOverTime: { day: string; amount: number }[] = [];
    const curDate = new Date(startStr);
    const stopDate = new Date(endStr);

    while (curDate <= stopDate) {
      const dStr = formatDateString(curDate);
      const amt = salesMap.get(dStr) || 0;
      const dayLabel = curDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      salesOverTime.push({ day: dayLabel, amount: amt });
      curDate.setDate(curDate.getDate() + 1);
    }

    // 8. Top 5 Best-Selling Products in Date Range
    const topProducts = db.prepare(`
      SELECT p.name, SUM(si.quantity) as sold, SUM(si.subtotal) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id AND si.business_id = s.business_id
      JOIN products p ON si.product_id = p.id
      WHERE si.business_id = ? AND s.status != 'CANCELLED' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT 5
    `).all(businessId, startStr, endStr);

    // 9. Payment Methods Distribution in Date Range
    const paymentMethods = db.prepare(`
      SELECT p.payment_method, COUNT(p.id) as count, SUM(p.amount) as total
      FROM payments p
      JOIN sales s ON p.sale_id = s.id AND p.business_id = s.business_id
      WHERE p.business_id = ? AND p.status = 'COMPLETED' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
      GROUP BY p.payment_method
    `).all(businessId, startStr, endStr);

    // 10. Recent Sales List (Latest 5 Sales)
    const recentSales = db.prepare(`
      SELECT s.id, s.invoice_number, s.grand_total, s.status, s.payment_method, s.created_at, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.business_id = ? AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?)
      ORDER BY s.created_at DESC
      LIMIT 5
    `).all(businessId, startStr, endStr);

    return res.json({
      success: true,
      periodLabel: label,
      dateRange: {
        preset: preset || 'today',
        startDate: startStr,
        endDate: endStr,
      },
      stats: {
        // Backward compatibility
        todaySales: totalSales,
        todayOrders: totalOrders,
        productsSold,
        grossProfit: netProfit,
        netEstimatedProfit: netProfit,
        todayExpenses: totalExpenses,
        lowStockItems: Number(lowStockRow.lowStockCount || 0),
        totalProducts: Number(totalProductsRow.totalProducts || 0),
        totalCustomers: Number(totalCustomersRow.totalCustomers || 0),
        // Range-aware fields
        totalSales,
        totalOrders,
        newCustomers,
        totalExpenses,
        cogs,
        netProfit,
        lowStockCount: Number(lowStockRow.lowStockCount || 0),
        comparisons: {
          salesGrowth: calcGrowth(totalSales, prevSales),
          ordersGrowth: calcGrowth(totalOrders, prevOrders),
          customersGrowth: calcGrowth(newCustomers, prevCustomers),
          profitGrowth: calcGrowth(netProfit, prevNetProfit),
        }
      },
      charts: {
        salesOverTime,
        topProducts,
        paymentMethods,
      },
      recentSales,
    });
  } catch (err: any) {
    console.error('[DashboardStats Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
