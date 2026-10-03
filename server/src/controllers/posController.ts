import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

import { createNotification } from '../utils/notificationLogger.ts';

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1, 'Item quantity must be at least 1'),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
});

const checkoutSchema = z.object({
  customerId: z.string().nullable().optional(),
  items: z.array(cartItemSchema).min(1, 'Cart cannot be empty'),
  subtotal: z.number().min(0),
  productDiscountsTotal: z.number().min(0).optional(),
  billDiscountPercent: z.number().min(0).max(100).optional(),
  billDiscountAmount: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  grandTotal: z.number().min(0),
  amountReceived: z.number().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'SPLIT']),
  payments: z.array(z.object({
    paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'SPLIT']),
    amount: z.number().min(0),
  })).optional(),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

const holdSaleSchema = z.object({
  customerId: z.string().nullable().optional(),
  cartJson: z.string().min(2, 'Cart JSON string is required'),
  note: z.string().optional(),
});

export async function checkoutSale(req: Request, res: Response) {
  try {
    const itemsRaw = Array.isArray(req.body.items) ? req.body.items.map((item: any) => ({
      productId: item.productId || item.id,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      discountPercent: item.discountPercent ?? item.discount_percent ?? 0,
      discount: item.discount ?? item.discountAmount ?? item.discount_amount ?? 0,
      tax: Number(item.tax || 0),
    })) : [];

    const checkoutBody = {
      ...req.body,
      items: itemsRaw,
    };

    const parseResult = checkoutSchema.safeParse(checkoutBody);
    if (!parseResult.success) {
      const errorMessages = parseResult.error?.issues?.map((e) => e.message) || parseResult.error?.errors?.map((e) => e.message) || ['Validation error in checkout payload'];
      return res.status(400).json({
        success: false,
        message: 'Validation error in checkout payload',
        errors: errorMessages,
        code: 'VALIDATION_ERROR',
      });
    }

    const {
      customerId,
      items,
      subtotal,
      productDiscountsTotal: payloadProdDiscounts,
      billDiscountPercent,
      billDiscountAmount,
      discount = 0,
      tax = 0,
      grandTotal,
      amountReceived = grandTotal,
      paymentMethod,
      payments,
      idempotencyKey,
      notes,
    } = parseResult.data;

    const businessId = req.businessId!;
    const userId = req.user?.userId;
    const effectiveIdempotencyKey = (req.headers['x-idempotency-key'] as string) || idempotencyKey;

    // 1. Idempotency Check: Protect against duplicate request submissions
    if (effectiveIdempotencyKey && effectiveIdempotencyKey.trim()) {
      const existingSale = db.prepare(`
        SELECT * FROM sales
        WHERE business_id = ? AND idempotency_key = ?
      `).get(businessId, effectiveIdempotencyKey.trim()) as any;

      if (existingSale) {
        const lineItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(existingSale.id);
        const paymentRecords = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(existingSale.id);

        return res.json({
          success: true,
          message: 'Sale already completed (idempotency duplicate prevented).',
          isDuplicatePrevented: true,
          sale: {
            ...existingSale,
            invoiceNumber: existingSale.invoice_number,
            grandTotal: existingSale.grand_total,
            paymentMethod: existingSale.payment_method,
          },
          items: lineItems,
          payments: paymentRecords,
        });
      }
    }

    // 2. Fetch Business Policy on Negative Inventory
    const negSetting = db.prepare("SELECT value FROM settings WHERE business_id = ? AND key = 'allow_negative_inventory'").get(businessId) as any;
    const allowNegativeInventory = negSetting?.value === 'true';

    // 2b. Validate Split Payment Breakdown Integrity
    if (paymentMethod === 'SPLIT') {
      if (!payments || payments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Split payment details are required when payment method is SPLIT.',
        });
      }
      const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
      if (Math.abs(totalPaid - grandTotal) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Split payment amounts sum (₹${totalPaid}) does not match sale grand total (₹${grandTotal}).`,
        });
      }
    }

    // 2c. Backend Discount Recalculation & Financial Integrity Verification
    let computedGrossSubtotal = 0;
    let computedItemDiscountsTotal = 0;
    const processedItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      discountAmount: number;
      taxAmount: number;
      lineSubtotal: number;
    }> = [];

    for (const item of items) {
      const dbProd = db.prepare('SELECT name, selling_price FROM products WHERE id = ? AND business_id = ?').get(item.productId, businessId) as any;
      const productName = dbProd?.name || 'Product';
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (dbProd?.selling_price || 0);

      const lineGross = unitPrice * item.quantity;
      let itemDiscountAmount = 0;
      let itemDiscountPercent = item.discountPercent || 0;

      if (item.discountPercent !== undefined && item.discountPercent > 0) {
        itemDiscountAmount = lineGross * (item.discountPercent / 100);
      } else if (item.discount !== undefined && item.discount > 0) {
        itemDiscountAmount = item.discount;
        itemDiscountPercent = lineGross > 0 ? (item.discount / lineGross) * 100 : 0;
      }

      // Clamp item discount to line gross
      itemDiscountAmount = Math.min(lineGross, Math.max(0, itemDiscountAmount));
      const lineSubtotal = lineGross - itemDiscountAmount;

      computedGrossSubtotal += lineGross;
      computedItemDiscountsTotal += itemDiscountAmount;

      processedItems.push({
        productId: item.productId,
        productName,
        quantity: item.quantity,
        unitPrice,
        discountPercent: Math.round(itemDiscountPercent * 100) / 100,
        discountAmount: Math.round(itemDiscountAmount * 100) / 100,
        taxAmount: item.tax || 0,
        lineSubtotal: Math.round(lineSubtotal * 100) / 100,
      });
    }

    const netItemsSubtotal = Math.max(0, computedGrossSubtotal - computedItemDiscountsTotal);

    let computedBillDiscountAmount = 0;
    let computedBillDiscountPercent = billDiscountPercent || 0;

    if (billDiscountPercent !== undefined && billDiscountPercent > 0) {
      computedBillDiscountAmount = netItemsSubtotal * (billDiscountPercent / 100);
    } else if (billDiscountAmount !== undefined && billDiscountAmount > 0) {
      computedBillDiscountAmount = billDiscountAmount;
      computedBillDiscountPercent = netItemsSubtotal > 0 ? (billDiscountAmount / netItemsSubtotal) * 100 : 0;
    } else if (discount > computedItemDiscountsTotal) {
      computedBillDiscountAmount = discount - computedItemDiscountsTotal;
      computedBillDiscountPercent = netItemsSubtotal > 0 ? (computedBillDiscountAmount / netItemsSubtotal) * 100 : 0;
    }

    computedBillDiscountAmount = Math.min(netItemsSubtotal, Math.max(0, computedBillDiscountAmount));
    const subtotalAfterAllDiscounts = Math.max(0, netItemsSubtotal - computedBillDiscountAmount);

    const totalCalculatedDiscount = computedItemDiscountsTotal + computedBillDiscountAmount;
    const computedTax = tax !== undefined ? tax : 0;
    const computedGrandTotal = Math.round((subtotalAfterAllDiscounts + computedTax) * 100) / 100;

    // Check against fraud / manipulated client totals
    if (Math.abs(computedGrandTotal - grandTotal) > 0.50) {
      return res.status(400).json({
        success: false,
        message: `Financial validation error: Computed grand total (₹${computedGrandTotal.toFixed(2)}) does not match submitted total (₹${grandTotal.toFixed(2)}).`,
        code: 'VALIDATION_ERROR',
      });
    }

    let createdSaleId = '';
    let invoiceNumber = '';
    let changeDue = Math.max(0, amountReceived - grandTotal);

    // 3. ATOMIC TRANSACTION EXECUTION
    db.transaction(() => {
      // Step A: Stock Validation for all items in cart
      for (const item of items) {
        const product = db.prepare(`
          SELECT id, name, current_stock, status
          FROM products
          WHERE id = ? AND business_id = ? AND status != 'ARCHIVED'
        `).get(item.productId, businessId) as any;

        if (!product) {
          throw new Error(`Product ID '${item.productId}' not found or is archived in your store.`);
        }

        if (!allowNegativeInventory && product.current_stock < item.quantity) {
          throw new Error(`Insufficient stock for '${product.name}'. Required: ${item.quantity} units, Available: ${product.current_stock} units.`);
        }
      }

      // Step B: Generate Sequential Invoice Number per business (e.g. INV-1001)
      const lastInvRow = db.prepare(`
        SELECT MAX(CAST(SUBSTR(invoice_number, 5) AS INTEGER)) as maxNum
        FROM sales
        WHERE business_id = ? AND invoice_number LIKE 'INV-%'
      `).get(businessId) as any;

      const nextNum = (lastInvRow && lastInvRow.maxNum ? Number(lastInvRow.maxNum) : 1000) + 1;
      invoiceNumber = `INV-${nextNum}`;
      createdSaleId = cryptoUUID();

      // Step C: Create Sales Record
      db.prepare(`
        INSERT INTO sales (
          id, business_id, user_id, customer_id, invoice_number,
          subtotal, discount, discount_percent, bill_discount_amount, product_discounts_total,
          tax, grand_total, payment_method, payment_status, status, idempotency_key, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'COMPLETED', ?, ?)
      `).run(
        createdSaleId,
        businessId,
        userId || null,
        customerId || null,
        invoiceNumber,
        subtotalAfterAllDiscounts,
        totalCalculatedDiscount,
        Math.round(computedBillDiscountPercent * 100) / 100,
        Math.round(computedBillDiscountAmount * 100) / 100,
        Math.round(computedItemDiscountsTotal * 100) / 100,
        computedTax,
        computedGrandTotal,
        paymentMethod,
        effectiveIdempotencyKey ? effectiveIdempotencyKey.trim() : null,
        notes || null
      );

      // Step D: Create Sale Line Items
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (
          id, business_id, sale_id, product_id, product_name, quantity, unit_price, discount, discount_percent, discount_amount, tax, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of processedItems) {
        insertItemStmt.run(
          cryptoUUID(),
          businessId,
          createdSaleId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.discountAmount,
          item.discountPercent,
          item.discountAmount,
          item.taxAmount,
          item.lineSubtotal
        );
      }

      // Step E: Create Payment Audit Records
      const insertPaymentStmt = db.prepare(`
        INSERT INTO payments (id, business_id, sale_id, payment_method, amount, status)
        VALUES (?, ?, ?, ?, ?, 'COMPLETED')
      `);

      if (paymentMethod === 'SPLIT' && payments && payments.length > 0) {
        for (const p of payments) {
          insertPaymentStmt.run(cryptoUUID(), businessId, createdSaleId, p.paymentMethod, p.amount);
        }
      } else {
        insertPaymentStmt.run(cryptoUUID(), businessId, createdSaleId, paymentMethod, grandTotal);
      }

      // Step F: Deduct Inventory & Insert Inventory Transactions Audit Logs
      const updateStockStmt = db.prepare(`
        UPDATE products
        SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          id, business_id, product_id, transaction_type, quantity, reference_id, notes, user_id
        ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?)
      `);

      for (const item of items) {
        // Deduct current stock
        updateStockStmt.run(item.quantity, item.productId, businessId);

        // Record SALE inventory transaction (negative delta for sale deduction)
        insertTxStmt.run(
          cryptoUUID(),
          businessId,
          item.productId,
          -item.quantity,
          invoiceNumber,
          `POS Sale Invoice #${invoiceNumber}`,
          userId || null
        );
      }

      // Step G: Update Customer Total Spent if customer assigned
      if (customerId) {
        db.prepare(`
          UPDATE customers
          SET total_spent = total_spent + ?
          WHERE id = ? AND business_id = ?
        `).run(grandTotal, customerId, businessId);
      }

    })(); // End Atomic Database Transaction

    logAuditEvent({
      businessId,
      userId,
      action: 'SALE_CREATED',
      entity: 'sale',
      entityId: createdSaleId,
      description: `New sale created (Invoice #${invoiceNumber})`,
      metadata: { invoiceNumber, grandTotal, paymentMethod },
    });

    logAuditEvent({
      businessId,
      userId,
      action: 'SALE_COMPLETED',
      entity: 'sale',
      entityId: createdSaleId,
      description: `Sale completed (Invoice #${invoiceNumber})`,
      metadata: { invoiceNumber, grandTotal, paymentMethod, itemCount: items.length },
    });

    logAuditEvent({
      businessId,
      userId,
      action: 'PAYMENT_CREATED',
      entity: 'payment',
      entityId: createdSaleId,
      description: `Payment recorded via ${paymentMethod} (₹${grandTotal})`,
      metadata: { paymentMethod, amount: grandTotal },
    });

    createNotification({
      businessId,
      userId,
      type: 'SALE_COMPLETED',
      title: 'Sale Completed',
      message: `Invoice #${invoiceNumber} completed for ₹${grandTotal}`,
      entityType: 'sale',
      entityId: createdSaleId,
    });

    // Check low stock / out of stock alerts
    for (const item of items) {
      const prod = db.prepare('SELECT name, current_stock, min_stock FROM products WHERE id = ?').get(item.productId) as any;
      if (prod) {
        if (prod.current_stock === 0) {
          createNotification({
            businessId,
            type: 'OUT_OF_STOCK',
            title: 'Out of Stock Alert',
            message: `${prod.name} is out of stock.`,
            entityType: 'product',
            entityId: item.productId,
          });
        } else if (prod.current_stock <= prod.min_stock) {
          createNotification({
            businessId,
            type: 'LOW_STOCK',
            title: 'Low Stock Warning',
            message: `${prod.name} is running low — ${prod.current_stock} units remaining.`,
            entityType: 'product',
            entityId: item.productId,
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `Sale completed successfully! Invoice #${invoiceNumber}`,
      sale: {
        id: createdSaleId,
        invoiceNumber,
        invoice_number: invoiceNumber,
        grandTotal,
        grand_total: grandTotal,
        subtotal,
        discount,
        tax,
        amountReceived,
        changeDue,
        paymentMethod,
        payment_method: paymentMethod,
        status: 'COMPLETED',
        payment_status: 'PAID',
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    });

  } catch (err: any) {
    console.error('[POS Checkout Error]', err);
    return res.status(400).json({
      success: false,
      message: err.message || 'Checkout failed due to transaction error.',
    });
  }
}

// Hold Sale Endpoint
export async function holdSale(req: Request, res: Response) {
  try {
    const parseResult = holdSaleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: 'Invalid cart payload' });
    }

    const { customerId, cartJson, note } = parseResult.data;
    const id = cryptoUUID();

    db.prepare(`
      INSERT INTO held_sales (id, business_id, user_id, customer_id, cart_json, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.businessId, req.user?.userId || null, customerId || null, cartJson, note || 'Held POS Cart');

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'SALE_HELD',
      entity: 'held_sale',
      entityId: id,
      description: 'POS cart placed on hold',
    });

    return res.status(201).json({
      success: true,
      message: 'Sale held successfully.',
      heldSaleId: id,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Held Sales List
export async function getHeldSales(req: Request, res: Response) {
  try {
    const heldSales = db.prepare(`
      SELECT h.*, c.name as customer_name, u.name as cashier_name
      FROM held_sales h
      LEFT JOIN customers c ON h.customer_id = c.id
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.business_id = ?
      ORDER BY h.created_at DESC
    `).all(req.businessId);

    return res.json({
      success: true,
      heldSales,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete / Resume Held Sale
export async function deleteHeldSale(req: Request, res: Response) {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM held_sales WHERE id = ? AND business_id = ?').run(id, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'SALE_RESUMED',
      entity: 'held_sale',
      entityId: id,
      description: 'Held POS cart resumed or cleared',
    });

    return res.json({ success: true, message: 'Held sale cleared.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Printable Receipt Data
export async function getSaleReceipt(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.business_id = ?
    `).get(id, req.businessId) as any;

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice record not found.' });
    }

    const items = db.prepare(`
      SELECT si.*, p.sku, p.barcode
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ? AND si.business_id = ?
    `).all(id, req.businessId);

    const payments = db.prepare(`
      SELECT * FROM payments WHERE sale_id = ? AND business_id = ?
    `).all(id, req.businessId);

    const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
    const settingsRows = db.prepare('SELECT key, value FROM settings WHERE business_id = ?').all(req.businessId) as { key: string; value: string }[];

    const settingsObj: Record<string, string> = {};
    settingsRows.forEach((r) => { settingsObj[r.key] = r.value; });

    return res.json({
      success: true,
      receipt: {
        business,
        settings: settingsObj,
        sale,
        items,
        payments,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
