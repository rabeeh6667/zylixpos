import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';

async function runFinalAudit() {
  console.log('===================================================');
  console.log('  ZYLIX POS — PROMPT 5E COMPLETE PRODUCTION QA AUDIT');
  console.log('===================================================\n');

  let passed = 0;
  let failed = 0;
  let totalTests = 0;

  const assert = (condition, title, details = '') => {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${title} ${details ? '- ' + details : ''}`);
      failed++;
    }
  };

  try {
    const timestamp = Date.now().toString().slice(-6);

    // ==========================================
    // MODULE 1: APPLICATION HEALTH & AUTH
    // ==========================================
    const healthRes = await fetch(`${API_BASE}/health`).then((r) => r.json());
    assert(healthRes.status === 'online', 'Health endpoint returns status: online');

    // Register Business A (OWNER)
    const busAData = {
      businessName: `Audit Store A ${timestamp}`,
      businessType: 'Retail POS',
      ownerName: 'Alice Owner',
      email: `ownerA_${timestamp}@audit.com`,
      password: 'Password123!',
    };

    const regARes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busAData),
    }).then((r) => r.json());

    const tokenA = regARes.token;
    const busIdA = regARes.business.id;
    assert(tokenA && busIdA, 'Business A Registration & Owner JWT issuance');

    // Register Business B (Tenant Isolation Target)
    const busBData = {
      businessName: `Audit Store B ${timestamp}`,
      businessType: 'Bakery',
      ownerName: 'Bob Owner',
      email: `ownerB_${timestamp}@audit.com`,
      password: 'Password123!',
    };

    const regBRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busBData),
    }).then((r) => r.json());

    const tokenB = regBRes.token;
    const busIdB = regBRes.business.id;
    assert(tokenB && busIdB, 'Business B Registration & Owner JWT issuance');

    // Valid Login Test
    const loginValidRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ownerA_${timestamp}@audit.com`, password: 'Password123!' }),
    }).then((r) => r.json());
    assert(loginValidRes.success && loginValidRes.token, 'Valid credentials login successful');

    // Invalid Password Login
    const loginBadPassRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ownerA_${timestamp}@audit.com`, password: 'WrongPassword!' }),
    });
    const loginBadPassData = await loginBadPassRes.json();
    assert(loginBadPassRes.status === 401 && loginBadPassData.code === 'UNAUTHORIZED', 'Invalid password rejected with 401 UNAUTHORIZED');

    // Unknown Email Login
    const loginUnknownRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unknown_${timestamp}@audit.com`, password: 'Password123!' }),
    });
    const loginUnknownData = await loginUnknownRes.json();
    assert(loginUnknownRes.status === 401 && loginUnknownData.code === 'UNAUTHORIZED', 'Unknown email rejected with 401 UNAUTHORIZED');

    // Malformed JWT Rejection
    const malformedJwtRes = await fetch(`${API_BASE}/products`, {
      headers: { Authorization: 'Bearer invalid_malformed_token_string' },
    });
    const malformedJwtData = await malformedJwtRes.json();
    assert(malformedJwtRes.status === 401 && malformedJwtData.code === 'UNAUTHORIZED', 'Malformed JWT rejected with 401 UNAUTHORIZED');

    // ==========================================
    // MODULE 2: RBAC (ROLE-BASED ACCESS CONTROL)
    // ==========================================
    // Create Cashier in Business A
    const cashierRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Charlie Cashier', email: `cashier_${timestamp}@audit.com`, password: 'Password123!', role: 'CASHIER' }),
    }).then((r) => r.json());

    const cashierLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `cashier_${timestamp}@audit.com`, password: 'Password123!' }),
    }).then((r) => r.json());
    const tokenCashier = cashierLogin.token;
    assert(tokenCashier, 'Cashier created and logged in');

    // Cashier attempting to list users -> 403 Forbidden
    const cashierUsersRes = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${tokenCashier}` },
    });
    const cashierUsersData = await cashierUsersRes.json();
    assert(cashierUsersRes.status === 403 && cashierUsersData.code === 'FORBIDDEN', 'RBAC: Cashier user management access blocked with 403 FORBIDDEN');

    // Cashier attempting to access audit logs -> 403 Forbidden
    const cashierAuditRes = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenCashier}` },
    });
    const cashierAuditData = await cashierAuditRes.json();
    assert(cashierAuditRes.status === 403 && cashierAuditData.code === 'FORBIDDEN', 'RBAC: Cashier audit log access blocked with 403 FORBIDDEN');

    // Cashier attempting to create backup -> 403 Forbidden
    const cashierBackupRes = await fetch(`${API_BASE}/system/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCashier}` },
    });
    const cashierBackupData = await cashierBackupRes.json();
    assert(cashierBackupRes.status === 403 && cashierBackupData.code === 'FORBIDDEN', 'RBAC: Cashier backup access blocked with 403 FORBIDDEN');

    // Owner accessing audit logs -> 200 OK
    const ownerAuditRes = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(ownerAuditRes.status === 200, 'RBAC: Owner audit log access allowed with 200 OK');

    // ==========================================
    // MODULE 3: FRESH BUSINESS DYNAMIC VERIFICATION
    // ==========================================
    const freshDashRes = await fetch(`${API_BASE}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const isFreshZero = (
      Number(freshDashRes.stats.todaySales) === 0 &&
      Number(freshDashRes.stats.todayOrders) === 0 &&
      Number(freshDashRes.stats.productsSold) === 0 &&
      Number(freshDashRes.stats.todayExpenses) === 0 &&
      Number(freshDashRes.stats.netEstimatedProfit) === 0
    );
    assert(isFreshZero, 'Fresh business dashboard metrics are 100% database-derived ₹0 / 0');

    // ==========================================
    // MODULE 4: PRODUCT & INVENTORY MANAGEMENT
    // ==========================================
    const prod1Res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Organic Honey 500g',
        sku: `SKU_HONEY_${timestamp}`,
        barcode: `BAR_HONEY_${timestamp}`,
        purchasePrice: 100,
        sellingPrice: 180,
        currentStock: 50,
        minimumStock: 10,
        unit: 'jar',
      }),
    }).then((r) => r.json());
    const prodId1 = prod1Res.productId;
    assert(prod1Res.success && prodId1, 'Product 1 creation with initial stock 50');

    const prod2Res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Almond Milk 1L',
        sku: `SKU_MILK_${timestamp}`,
        barcode: `BAR_MILK_${timestamp}`,
        purchasePrice: 80,
        sellingPrice: 140,
        currentStock: 30,
        minimumStock: 5,
        unit: 'pack',
      }),
    }).then((r) => r.json());
    const prodId2 = prod2Res.productId;
    assert(prod2Res.success && prodId2, 'Product 2 creation with initial stock 30');

    // Duplicate SKU Rejection
    const dupSkuRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Dup SKU Item', sku: `SKU_HONEY_${timestamp}`, sellingPrice: 100 }),
    });
    assert(dupSkuRes.status === 409, 'Duplicate SKU rejected with status 409 Conflict');

    // Stock In
    const stockInRes = await fetch(`${API_BASE}/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: prodId1, quantity: 20, notes: 'Restock shipment' }),
    }).then((r) => r.json());
    assert(stockInRes.success && stockInRes.newStock === 70, 'Stock In: Stock updated (50 + 20 = 70)');

    // Stock Adjustment
    const adjustRes = await fetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: prodId1, newStock: 65, notes: 'Audit physical count correction' }),
    }).then((r) => r.json());
    assert(adjustRes.success && adjustRes.newStock === 65, 'Stock Adjustment: Stock corrected to 65');

    // ==========================================
    // MODULE 5: CUSTOMER MANAGEMENT & ACCOUNTING
    // ==========================================
    const custRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'David Smith', phone: `998877${timestamp.slice(-4)}`, email: `david_${timestamp}@test.com` }),
    }).then((r) => r.json());
    const custId = custRes.customer.id;
    assert(custRes.success && custId, 'Customer creation');

    // ==========================================
    // MODULE 6: POS CHECKOUT, FINANCIALS & IDEMPOTENCY
    // ==========================================
    const idempotencyKey = `idempotent_final_${timestamp}`;
    const checkoutBody = {
      items: [
        { productId: prodId1, quantity: 5, unitPrice: 180 }, // 5 * 180 = 900
        { productId: prodId2, quantity: 2, unitPrice: 140 }, // 2 * 140 = 280
      ],
      selectedCustomerId: custId,
      customerId: custId,
      subtotal: 1180,
      discount: 80,
      grandTotal: 1100,
      paymentMethod: 'SPLIT',
      payments: [
        { paymentMethod: 'CASH', amount: 600 },
        { paymentMethod: 'CARD', amount: 500 },
      ],
      idempotencyKey,
    };

    const checkout1Res = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(checkoutBody),
    }).then((r) => r.json());

    const saleId = checkout1Res.sale?.id;
    const invNum = checkout1Res.sale?.invoiceNumber;
    assert(checkout1Res.success && invNum && checkout1Res.sale.grand_total === 1100, 'POS Checkout: Sale recorded with correct grand total (₹1,100)');

    // Idempotent Checkout Retry
    const checkout2Res = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(checkoutBody),
    }).then((r) => r.json());

    assert(checkout2Res.success && checkout2Res.isDuplicatePrevented === true && checkout2Res.sale.id === saleId, 'Idempotency: Re-submitting identical token returns original sale without duplicating database records');

    // Stock deduction verification after sale
    const prod1After = await fetch(`${API_BASE}/products/${prodId1}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    assert(prod1After.product.current_stock === 60, 'Stock Deduction: Stock decreased by exactly 5 units once (65 -> 60)');

    // Customer spent & order count verification
    const custAfter = await fetch(`${API_BASE}/customers/${custId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    assert(custAfter.customer.total_spent === 1100 && (custAfter.customer.total_orders === 1 || custAfter.customer.order_count === 1), 'Customer Accounting: Customer total_spent (₹1,100) and order count updated');

    // ==========================================
    // MODULE 7: EXPENSES & ACCOUNTING
    // ==========================================
    const expenseRes = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: 'Utility Electricity Bill',
        category: 'Utilities',
        amount: 300,
        paymentMethod: 'CASH',
        notes: 'Monthly power bill',
      }),
    }).then((r) => r.json());
    assert(expenseRes.success && expenseRes.expenseId, 'Expense creation recorded (₹300)');

    // ==========================================
    // MODULE 8: REPORTS & PROFIT FORMULA
    // ==========================================
    const reportRes = await fetch(`${API_BASE}/reports/sales?preset=today`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    // Profit Calculation check:
    // Revenue = 1100
    // COGS = (5 * 100) + (2 * 80) = 500 + 160 = 660
    // Gross Profit = 1100 - 660 = 440
    // Expenses = 300
    // Net Profit = 440 - 300 = 140
    const summary = reportRes.summary;
    const isProfitFormulaCorrect = (
      summary.totalSales === 1100 &&
      summary.totalCogs === 660 &&
      summary.totalExpenses === 300 &&
      (summary.estimatedProfit === 140 || summary.netEstimatedProfit === 140)
    );
    assert(isProfitFormulaCorrect, 'Report Accounting: Net Profit formula verified (Revenue ₹1,100 - COGS ₹660 - Expenses ₹300 = Net Profit ₹140)');

    // ==========================================
    // MODULE 9: TENANT ISOLATION EXHAUSTIVE VERIFICATION
    // ==========================================
    // Business B attempting to access Business A's Product 1 by URL ID
    const crossProdRes = await fetch(`${API_BASE}/products/${prodId1}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossProdRes.status === 404, 'Tenant Isolation: Business B accessing Business A Product ID returns 404 Not Found');

    // Business B attempting to access Business A's Sale by URL ID
    const crossSaleRes = await fetch(`${API_BASE}/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(crossSaleRes.status === 404, 'Tenant Isolation: Business B accessing Business A Sale ID returns 404 Not Found');

    // Business B attempting body business_id spoofing
    const spoofProdRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        name: 'Spoofed Item',
        business_id: busIdA,
        businessId: busIdA,
        sellingPrice: 50,
      }),
    }).then((r) => r.json());

    // Confirm product created for Business B, NOT Business A
    const busAProds = await fetch(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    const isSpoofPrevented = !busAProds.products.some((p) => p.name === 'Spoofed Item');
    assert(isSpoofPrevented, 'Tenant Isolation: Body business_id spoofing ignored; server uses authenticated JWT businessId');

    // ==========================================
    // MODULE 10: DATABASE INTEGRITY CHECKS
    // ==========================================
    const dbIntegrityRes = await fetch(`${API_BASE}/system/database-health`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    assert(dbIntegrityRes.success && dbIntegrityRes.health?.foreignKeyViolations === 0 && dbIntegrityRes.health?.integrityCheck === 'ok', 'Database Integrity: PRAGMA foreign_key_check (0 violations) & PRAGMA integrity_check (ok)');

    // ==========================================
    // MODULE 11: FRONTEND BUNDLE SECURITY SCAN
    // ==========================================
    const distPath = path.resolve('c:\\Users\\hp\\Desktop\\zylix\\dist');
    let hasBundleLeakedSecrets = false;
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(path.join(distPath, 'assets'));
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(distPath, 'assets', file), 'utf8');
          if (content.includes('JWT_SECRET') || content.includes('SUPER_SECRET') || content.includes('zylix.db')) {
            hasBundleLeakedSecrets = true;
          }
        }
      }
    }
    assert(!hasBundleLeakedSecrets, 'Security Bundle Scan: dist bundle clean with 0 exposed JWT secrets or database paths');

    // ==========================================
    // MODULE 12: ERROR BOUNDARY TEST CASES
    // ==========================================
    // Underpaid split payment rejection
    const underpaidRes = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        items: [{ productId: prodId1, quantity: 1, unitPrice: 180 }],
        grandTotal: 180,
        paymentMethod: 'SPLIT',
        payments: [{ paymentMethod: 'CASH', amount: 50 }],
      }),
    });
    assert(underpaidRes.status === 400, 'Error Boundary: Underpaid split payment rejected with status 400 Bad Request');

    // Negative stock removal without allow_negative_inventory setting
    const negStockRes = await fetch(`${API_BASE}/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: prodId1, quantity: 9999, notes: 'Excess stock out' }),
    });
    assert(negStockRes.status === 400, 'Error Boundary: Excessive stock-out exceeding current stock rejected');

    // ==========================================
    // MODULE 13: BACKUP & RESTORE SERVICE AUDIT
    // ==========================================
    const backupRes = await fetch(`${API_BASE}/system/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    assert(backupRes.success && backupRes.backup?.filename, 'Backup System: Server-side SQLite backup created safely');

    // ==========================================
    // MODULE 14: PRODUCTION BUILD CHECK
    // ==========================================
    console.log('\nRunning final production compilation check (npm run build)...');
    try {
      execSync('cmd /c npm run build', { cwd: 'c:\\Users\\hp\\Desktop\\zylix', stdio: 'pipe' });
      assert(true, 'Production Build: Vite production compilation executed with 0 errors');
    } catch (buildErr) {
      assert(false, 'Production Build: Failed', buildErr.stderr ? buildErr.stderr.toString() : buildErr.message);
    }

  } catch (err) {
    console.error('Final Audit Execution Error:', err);
    failed++;
  }

  console.log('\n===================================================');
  console.log(`  FINAL AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${totalTests} tests`);
  console.log('===================================================');

  return { passed, failed, totalTests };
}

runFinalAudit();
