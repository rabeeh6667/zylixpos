import { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/dbAdapter.ts';
import { hashPassword } from '../utils/password.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const createTenantSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessType: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email('Invalid business email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  taxNumber: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  description: z.string().optional(),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerEmail: z.string().email('Invalid owner email'),
  ownerPhone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

const updateTenantSchema = z.object({
  businessName: z.string().min(2).optional(),
  businessType: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  taxNumber: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  description: z.string().optional(),
  ownerName: z.string().min(2).optional(),
  ownerEmail: z.string().email().optional(),
  ownerPhone: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export async function getTenants(req: Request, res: Response) {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(String(status).toUpperCase());
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      whereClause += ' AND (b.name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR b.email LIKE ?)';
      params.push(term, term, term, term);
    }

    // Global Summary Aggregation across all tenants
    const summary = (await queryOne<any>(`
      SELECT
        (SELECT COUNT(id) FROM businesses) as total_tenants,
        (SELECT COUNT(id) FROM businesses WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE') as active_tenants,
        (SELECT COUNT(id) FROM businesses WHERE status = 'SUSPENDED') as suspended_tenants,
        (SELECT COUNT(id) FROM businesses WHERE status = 'PENDING') as pending_tenants,
        (SELECT COUNT(id) FROM users) as total_users,
        (SELECT COUNT(id) FROM products WHERE status != 'ARCHIVED') as total_products,
        (SELECT COUNT(id) FROM sales WHERE status != 'CANCELLED') as total_sales,
        (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE status != 'CANCELLED') as total_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments) as platform_collected_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments WHERE payment_type = 'INITIAL_PAYMENT') as total_initial_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments WHERE payment_type = 'MONTHLY_SUBSCRIPTION') as total_subscriptions
    `)) || {
      total_tenants: 0,
      active_tenants: 0,
      suspended_tenants: 0,
      pending_tenants: 0,
      total_users: 0,
      total_products: 0,
      total_sales: 0,
      total_revenue: 0,
      platform_collected_revenue: 0,
      total_initial_payments: 0,
      total_subscriptions: 0,
    };

    // Count Total matching search/filter
    const countRow = (await queryOne<any>(`
      SELECT COUNT(DISTINCT b.id) as total
      FROM businesses b
      LEFT JOIN users u ON b.id = u.business_id AND u.role = 'OWNER'
      ${whereClause}
    `, params)) || { total: 0 };

    const total = Number(countRow.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    // List Query with Aggregations
    const sql = `
      SELECT
        b.id,
        b.name as business_name,
        b.business_type,
        b.phone as business_phone,
        b.email as business_email,
        b.address,
        b.city,
        b.state,
        b.country,
        b.tax_number,
        b.currency,
        b.timezone,
        b.description,
        COALESCE(b.status, 'ACTIVE') as status,
        b.created_at,
        u.id as owner_id,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(id) FROM users WHERE business_id = b.id) as total_users,
        (SELECT COUNT(id) FROM products WHERE business_id = b.id AND status != 'ARCHIVED') as total_products,
        (SELECT COUNT(id) FROM customers WHERE business_id = b.id AND status != 'ARCHIVED') as total_customers,
        (SELECT COUNT(id) FROM sales WHERE business_id = b.id AND status != 'CANCELLED') as total_sales,
        (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE business_id = b.id AND status != 'CANCELLED') as total_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments WHERE business_id = b.id) as platform_collected_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments WHERE business_id = b.id AND payment_type = 'INITIAL_PAYMENT') as initial_payment_total,
        (SELECT COALESCE(SUM(amount), 0) FROM tenant_payments WHERE business_id = b.id AND payment_type = 'MONTHLY_SUBSCRIPTION') as monthly_subscription_total,
        (SELECT MAX(created_at) FROM sales WHERE business_id = b.id) as last_activity
      FROM businesses b
      LEFT JOIN users u ON b.id = u.business_id AND u.role = 'OWNER'
      ${whereClause}
      GROUP BY b.id, b.name, b.business_type, b.phone, b.email, b.address, b.city, b.state, b.country, b.tax_number, b.currency, b.timezone, b.description, b.status, b.created_at, u.id, u.name, u.email
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = await query(sql, [...params, limitNum, offset]);

    return res.json({
      success: true,
      summary,
      items,
      tenants: items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    });
  } catch (err: any) {
    console.error('[getTenants Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function getTenantById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { range, startDate, endDate } = req.query;

    const business = await queryOne<any>(`
      SELECT b.*, COALESCE(b.status, 'ACTIVE') as status, u.id as owner_id, u.name as owner_name, u.email as owner_email
      FROM businesses b
      LEFT JOIN users u ON b.id = u.business_id AND u.role = 'OWNER'
      WHERE b.id = ?
    `, [id]);

    if (!business) {
      return res.status(404).json({ success: false, message: 'Tenant business not found.', code: 'RESOURCE_NOT_FOUND' });
    }

    // Date Filtering Logic
    let dateFilterSales = '';
    let dateFilterExpenses = '';
    const dateParamsSales: any[] = [id];
    const dateParamsExpenses: any[] = [id];

    if (startDate) {
      dateFilterSales += ' AND date(created_at) >= date(?)';
      dateParamsSales.push(String(startDate));
      dateFilterExpenses += ' AND date(expense_date) >= date(?)';
      dateParamsExpenses.push(String(startDate));
    }
    if (endDate) {
      dateFilterSales += ' AND date(created_at) <= date(?)';
      dateParamsSales.push(String(endDate));
      dateFilterExpenses += ' AND date(expense_date) <= date(?)';
      dateParamsExpenses.push(String(endDate));
    }

    // Live Aggregated Database Metrics
    const usersCountRow = await queryOne<any>('SELECT COUNT(id) as cnt FROM users WHERE business_id = ?', [id]);
    const usersCount = Number(usersCountRow?.cnt || 0);

    const activeUsersRow = await queryOne<any>("SELECT COUNT(id) as cnt FROM users WHERE business_id = ? AND status = 'ACTIVE'", [id]);
    const activeUsersCount = Number(activeUsersRow?.cnt || 0);

    const productsCountRow = await queryOne<any>("SELECT COUNT(id) as cnt FROM products WHERE business_id = ? AND status != 'ARCHIVED'", [id]);
    const productsCount = Number(productsCountRow?.cnt || 0);

    const customersCountRow = await queryOne<any>("SELECT COUNT(id) as cnt FROM customers WHERE business_id = ? AND status != 'ARCHIVED'", [id]);
    const customersCount = Number(customersCountRow?.cnt || 0);
    
    const salesRow = (await queryOne<any>(`
      SELECT COUNT(id) as ordersCount, COALESCE(SUM(grand_total), 0) as revenue
      FROM sales
      WHERE business_id = ? AND status != 'CANCELLED' ${dateFilterSales}
    `, dateParamsSales)) || { ordersCount: 0, revenue: 0 };

    const cogsRow = (await queryOne<any>(`
      SELECT COALESCE(SUM(si.quantity * p.purchase_price), 0) as cogs
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.business_id = ? AND s.status != 'CANCELLED' ${dateFilterSales.replace(/created_at/g, 's.created_at')}
    `, dateParamsSales)) || { cogs: 0 };

    const expensesRow = (await queryOne<any>(`
      SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM expenses
      WHERE business_id = ? AND status != 'ARCHIVED' ${dateFilterExpenses}
    `, dateParamsExpenses)) || { totalExpenses: 0 };

    const invValRow = (await queryOne<any>("SELECT COALESCE(SUM(current_stock * purchase_price), 0) as invVal, COUNT(CASE WHEN current_stock <= min_stock THEN 1 END) as lowStock FROM products WHERE business_id = ? AND status = 'ACTIVE'", [id])) || { invVal: 0, lowStock: 0 };
    const lastActivityRow = await queryOne<any>("SELECT MAX(created_at) as lastAct FROM sales WHERE business_id = ?", [id]);

    const revenue = Number(salesRow.revenue || 0);
    const cogs = Number(cogsRow.cogs || 0);
    const totalExpenses = Number(expensesRow.totalExpenses || 0);
    const estimatedProfit = revenue - cogs - totalExpenses;

    // Recent Activity Log & Transactions
    const recentSales = await query("SELECT s.id, s.invoice_number, s.grand_total, s.created_at, s.payment_method FROM sales s WHERE s.business_id = ? ORDER BY s.created_at DESC LIMIT 5", [id]);
    const recentExpenses = await query("SELECT e.id, e.title, e.category, e.amount, e.created_at FROM expenses e WHERE e.business_id = ? ORDER BY e.created_at DESC LIMIT 5", [id]);
    const recentAuditLogs = await query("SELECT a.id, a.action, a.entity, a.description, a.created_at, u.name as user_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE a.business_id = ? ORDER BY a.created_at DESC LIMIT 10", [id]);

    const tenantPayments = await query("SELECT id, payment_type, amount, payment_date, payment_method, notes, created_at FROM tenant_payments WHERE business_id = ? ORDER BY payment_date DESC", [id]);
    const platformRevenueRow = await queryOne<any>(`
      SELECT
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN payment_type = 'INITIAL_PAYMENT' THEN amount ELSE 0 END), 0) as initial_total,
        COALESCE(SUM(CASE WHEN payment_type = 'MONTHLY_SUBSCRIPTION' THEN amount ELSE 0 END), 0) as subscription_total
      FROM tenant_payments
      WHERE business_id = ?
    `, [id]);

    return res.json({
      success: true,
      tenant: business,
      stats: {
        totalUsers: usersCount,
        activeUsers: activeUsersCount,
        totalProducts: productsCount,
        totalCustomers: customersCount,
        totalSales: Number(salesRow.ordersCount || 0),
        totalOrders: Number(salesRow.ordersCount || 0),
        totalRevenue: revenue,
        platformCollectedRevenue: Number(platformRevenueRow?.total_collected || 0),
        initialPaymentTotal: Number(platformRevenueRow?.initial_total || 0),
        subscriptionTotal: Number(platformRevenueRow?.subscription_total || 0),
        totalExpenses,
        cogs,
        estimatedProfit,
        inventoryValuation: Number(invValRow.invVal || 0),
        lowStockCount: Number(invValRow.lowStock || 0),
        lastActivity: lastActivityRow?.lastAct || null,
      },
      recentSales,
      recentExpenses,
      recentAuditLogs,
      tenantPayments,
    });
  } catch (err: any) {
    console.error('[getTenantById Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function createTenant(req: Request, res: Response) {
  try {
    const body = {
      businessName: req.body.businessName || req.body.name,
      businessType: req.body.businessType,
      businessPhone: req.body.businessPhone || req.body.phone,
      businessEmail: req.body.businessEmail || req.body.email,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      country: req.body.country,
      taxNumber: req.body.taxNumber,
      currency: req.body.currency,
      timezone: req.body.timezone,
      description: req.body.description,
      ownerName: req.body.ownerName,
      ownerEmail: req.body.ownerEmail,
      ownerPhone: req.body.ownerPhone,
      password: req.body.password,
      status: req.body.status,
    };

    const parseResult = createTenantSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error?.issues?.map((e) => e.message) || parseResult.error?.errors?.map((e) => e.message) || ['Invalid payload'];
      return res.status(400).json({
        success: false,
        message: 'Validation failed for tenant creation payload',
        errors: errorMessages,
        code: 'VALIDATION_ERROR',
      });
    }

    const {
      businessName,
      businessType,
      businessPhone,
      businessEmail,
      address,
      city,
      state,
      country,
      taxNumber,
      currency = 'INR',
      timezone = 'Asia/Kolkata',
      description,
      ownerName,
      ownerEmail,
      password,
      status = 'ACTIVE',
    } = parseResult.data;

    // Check duplicate owner email
    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [ownerEmail.toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email '${ownerEmail}' already exists.`,
        code: 'CONFLICT',
      });
    }

    const businessId = cryptoUUID();
    const userId = cryptoUUID();
    const passwordHash = await hashPassword(password);

    // Atomic Database Insertion
    await transaction(async (tx) => {
      // 1. Business
      await tx.execute(`
        INSERT INTO businesses (
          id, name, business_type, phone, email, address, city, state, country, tax_number, currency, timezone, description, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        businessId,
        businessName.trim(),
        businessType ? businessType.trim() : 'Retail POS',
        businessPhone || null,
        businessEmail ? businessEmail.toLowerCase().trim() : null,
        address || null,
        city || null,
        state || null,
        country || 'India',
        taxNumber || null,
        currency,
        timezone,
        description || null,
        status
      ]);

      // 2. Owner User
      await tx.execute(`
        INSERT INTO users (id, business_id, name, email, password_hash, role, status, is_platform_owner)
        VALUES (?, ?, ?, ?, ?, 'OWNER', 'ACTIVE', 0)
      `, [userId, businessId, ownerName.trim(), ownerEmail.toLowerCase().trim(), passwordHash]);

      // 3. Default Settings
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'currency', currency]);
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'currency_symbol', currency === 'INR' ? '₹' : '$']);
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'tax_rate', '18.0']);
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'receipt_header', `${businessName} - Thank you for shopping with us!`]);
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'low_stock_threshold', '5']);
      await tx.execute('INSERT INTO settings (id, business_id, key, value) VALUES (?, ?, ?, ?)', [cryptoUUID(), businessId, 'allow_negative_inventory', 'false']);

      // 4. Default Expense Categories
      const defaultCategories = ['Rent & Facilities', 'Utilities', 'Staff Salaries', 'Inventory Supplies', 'Marketing & Ads', 'Miscellaneous'];
      for (const cat of defaultCategories) {
        await tx.execute('INSERT INTO expense_categories (id, business_id, name, description) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', [cryptoUUID(), businessId, cat, `Default category for ${cat}`]);
      }
    });

    logAuditEvent({
      businessId: req.businessId || businessId,
      userId: req.user?.userId,
      action: 'TENANT_CREATED',
      entity: 'business',
      entityId: businessId,
      description: `New platform tenant created: ${businessName} (Owner: ${ownerName})`,
      metadata: { businessName, ownerName, ownerEmail, status },
    });

    return res.status(201).json({
      success: true,
      message: `Tenant business '${businessName}' created successfully.`,
      businessId,
      userId,
      business: {
        id: businessId,
        name: businessName,
        business_name: businessName,
        business_phone: businessPhone,
        business_email: businessEmail,
        address,
        description,
        status,
      },
      tenant: {
        id: businessId,
        business_name: businessName,
        business_phone: businessPhone,
        business_email: businessEmail,
        address,
        description,
        status,
      },
      owner: {
        id: userId,
        business_id: businessId,
        name: ownerName,
        email: ownerEmail,
        role: 'OWNER',
        password_hash: passwordHash,
      }
    });
  } catch (err: any) {
    console.error('[createTenant Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function updateTenant(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existingBus = await queryOne<any>('SELECT * FROM businesses WHERE id = ?', [id]);
    if (!existingBus) {
      return res.status(404).json({ success: false, message: 'Tenant business not found.', code: 'RESOURCE_NOT_FOUND' });
    }

    const parseResult = updateTenantSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
        code: 'VALIDATION_ERROR',
      });
    }

    const d = parseResult.data;

    // Updates for business table
    const busUpdates: string[] = [];
    const busParams: any[] = [];

    if (d.businessName !== undefined) { busUpdates.push('name = ?'); busParams.push(d.businessName.trim()); }
    if (d.businessType !== undefined) { busUpdates.push('business_type = ?'); busParams.push(d.businessType.trim()); }
    if (d.businessPhone !== undefined) { busUpdates.push('phone = ?'); busParams.push(d.businessPhone || null); }
    if (d.businessEmail !== undefined) { busUpdates.push('email = ?'); busParams.push(d.businessEmail ? d.businessEmail.toLowerCase().trim() : null); }
    if (d.address !== undefined) { busUpdates.push('address = ?'); busParams.push(d.address || null); }
    if (d.city !== undefined) { busUpdates.push('city = ?'); busParams.push(d.city || null); }
    if (d.state !== undefined) { busUpdates.push('state = ?'); busParams.push(d.state || null); }
    if (d.country !== undefined) { busUpdates.push('country = ?'); busParams.push(d.country || null); }
    if (d.taxNumber !== undefined) { busUpdates.push('tax_number = ?'); busParams.push(d.taxNumber || null); }
    if (d.currency !== undefined) { busUpdates.push('currency = ?'); busParams.push(d.currency || 'INR'); }
    if (d.timezone !== undefined) { busUpdates.push('timezone = ?'); busParams.push(d.timezone || 'Asia/Kolkata'); }
    if (d.description !== undefined) { busUpdates.push('description = ?'); busParams.push(d.description || null); }
    if (d.status !== undefined) { busUpdates.push('status = ?'); busParams.push(d.status); }

    await transaction(async (tx) => {
      if (busUpdates.length > 0) {
        busUpdates.push('updated_at = CURRENT_TIMESTAMP');
        busParams.push(id);
        await tx.execute(`UPDATE businesses SET ${busUpdates.join(', ')} WHERE id = ?`, busParams);
      }

      // Updates for owner user
      const ownerUser = await tx.queryOne<any>("SELECT id FROM users WHERE business_id = ? AND role = 'OWNER'", [id]);
      if (ownerUser) {
        const userUpdates: string[] = [];
        const userParams: any[] = [];

        if (d.ownerName !== undefined) { userUpdates.push('name = ?'); userParams.push(d.ownerName.trim()); }
        if (d.ownerEmail !== undefined) { userUpdates.push('email = ?'); userParams.push(d.ownerEmail.toLowerCase().trim()); }

        if (userUpdates.length > 0) {
          userUpdates.push('updated_at = CURRENT_TIMESTAMP');
          userParams.push(ownerUser.id);
          await tx.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
        }
      }
    });

    logAuditEvent({
      businessId: (req.businessId || id) as string,
      userId: req.user?.userId,
      action: 'TENANT_UPDATED',
      entity: 'business',
      entityId: id as string,
      description: `Tenant business updated: ${d.businessName || existingBus.name}`,
      metadata: d,
    });

    const updatedTenant = await queryOne(`
      SELECT b.*, b.name as business_name, COALESCE(b.status, 'ACTIVE') as status, u.name as owner_name, u.email as owner_email
      FROM businesses b
      LEFT JOIN users u ON b.id = u.business_id AND u.role = 'OWNER'
      WHERE b.id = ?
    `, [id]);

    return res.json({
      success: true,
      message: 'Tenant business updated successfully.',
      tenant: updatedTenant,
    });
  } catch (err: any) {
    console.error('[updateTenant Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function updateTenantStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'SUSPENDED'].includes(String(status).toUpperCase())) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'ACTIVE' or 'SUSPENDED'.", code: 'VALIDATION_ERROR' });
    }

    const newStatus = String(status).toUpperCase();

    const existing = await queryOne<any>('SELECT id, name FROM businesses WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tenant business not found.', code: 'RESOURCE_NOT_FOUND' });
    }

    await execute('UPDATE businesses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    if (newStatus === 'ACTIVE') {
      await execute("UPDATE users SET status = 'ACTIVE' WHERE business_id = ? AND (status = 'PENDING' OR status IS NULL)", [id]);
    }

    const actionType = newStatus === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED';

    logAuditEvent({
      businessId: (req.businessId || id) as string,
      userId: req.user?.userId,
      action: actionType,
      entity: 'business',
      entityId: id as string,
      description: `Tenant business '${existing.name}' status set to ${newStatus}`,
      metadata: { status: newStatus },
    });

    return res.json({
      success: true,
      message: `Tenant status updated to ${newStatus}.`,
      status: newStatus,
      business: { id, status: newStatus, name: existing.name },
      tenant: { id, status: newStatus, business_name: existing.name },
    });
  } catch (err: any) {
    console.error('[updateTenantStatus Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

const addPaymentSchema = z.object({
  paymentType: z.enum(['INITIAL_PAYMENT', 'MONTHLY_SUBSCRIPTION', 'OTHER']),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(['UPI', 'CARD', 'BANK_TRANSFER', 'CASH', 'OTHER']).optional(),
  notes: z.string().optional(),
});

export async function addTenantPayment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parseResult = addPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.issues.map((e: any) => e.message),
        code: 'VALIDATION_ERROR',
      });
    }

    const tenant = await queryOne<any>('SELECT id, name FROM businesses WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant business not found.', code: 'RESOURCE_NOT_FOUND' });
    }

    const { paymentType, amount, paymentDate, paymentMethod, notes } = parseResult.data;
    const paymentId = cryptoUUID();
    const dateToUse = paymentDate || new Date().toISOString();

    await execute(`
      INSERT INTO tenant_payments (id, business_id, payment_type, amount, payment_date, payment_method, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentId,
      id,
      paymentType,
      amount,
      dateToUse,
      paymentMethod || 'UPI',
      notes || null,
      req.user?.userId || null
    ]);

    logAuditEvent({
      businessId: id as string,
      userId: req.user?.userId,
      action: 'TENANT_PAYMENT_RECORDED',
      entity: 'tenant_payment',
      entityId: paymentId,
      description: `Recorded ${paymentType} of ${amount} for tenant '${tenant.name}'`,
      metadata: { paymentType, amount, paymentMethod, notes },
    });

    return res.status(201).json({
      success: true,
      message: 'Platform revenue recorded successfully!',
      payment: {
        id: paymentId,
        business_id: id,
        payment_type: paymentType,
        amount,
        payment_date: dateToUse,
        payment_method: paymentMethod || 'UPI',
        notes: notes || null,
      },
    });
  } catch (err: any) {
    console.error('[addTenantPayment Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function getTenantPayments(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenant = await queryOne<any>('SELECT id, name FROM businesses WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant business not found.', code: 'RESOURCE_NOT_FOUND' });
    }

    const payments = await query(`
      SELECT id, business_id, payment_type, amount, payment_date, payment_method, notes, created_at
      FROM tenant_payments
      WHERE business_id = ?
      ORDER BY payment_date DESC, created_at DESC
    `, [id]);

    const totals = await queryOne<any>(`
      SELECT
        COALESCE(SUM(amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN payment_type = 'INITIAL_PAYMENT' THEN amount ELSE 0 END), 0) as initial_total,
        COALESCE(SUM(CASE WHEN payment_type = 'MONTHLY_SUBSCRIPTION' THEN amount ELSE 0 END), 0) as subscription_total
      FROM tenant_payments
      WHERE business_id = ?
    `, [id]);

    return res.json({
      success: true,
      payments,
      totals: {
        totalCollected: Number(totals?.total_collected || 0),
        initialTotal: Number(totals?.initial_total || 0),
        subscriptionTotal: Number(totals?.subscription_total || 0),
      },
    });
  } catch (err: any) {
    console.error('[getTenantPayments Error]', err);
    return res.status(500).json({ success: false, message: err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
}
