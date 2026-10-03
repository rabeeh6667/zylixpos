const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('===================================================');
  console.log('  ZYLIX POS — PROMPT 5A AUDIT & NOTIFICATION TESTS');
  console.log('===================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} - ${details}`);
      failed++;
    }
  };

  try {
    // 1. Setup Business A (Owner & Cashier) and Business B (Owner)
    const suffix = Date.now().toString().slice(-6);
    const busABody = {
      businessName: `Audit Test Store A ${suffix}`,
      businessType: 'Retail',
      ownerName: 'Owner A',
      email: `ownerA_${suffix}@audit.com`,
      password: 'Password123!',
    };

    const regARes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busABody),
    }).then((r) => r.json());

    const tokenA = regARes.token;
    const busIdA = regARes.business.id;

    // Create Cashier for Business A
    const cashierRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Cashier A',
        email: `cashierA_${suffix}@audit.com`,
        password: 'Password123!',
        role: 'CASHIER',
      }),
    }).then((r) => r.json());

    const cashierLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `cashierA_${suffix}@audit.com`, password: 'Password123!' }),
    }).then((r) => r.json());

    const tokenCashierA = cashierLogin.token;

    // Setup Business B
    const busBBody = {
      businessName: `Audit Test Store B ${suffix}`,
      businessType: 'Bakery',
      ownerName: 'Owner B',
      email: `ownerB_${suffix}@audit.com`,
      password: 'Password123!',
    };

    const regBRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busBBody),
    }).then((r) => r.json());

    const tokenB = regBRes.token;

    // --- TEST 1: Audit log created after product creation ---
    const prodRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Audit Test Product', sellingPrice: 150, currentStock: 20 }),
    }).then((r) => r.json());

    const auditAfterProd = await fetch(`${API_BASE}/audit-logs?action=PRODUCT_CREATED`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const hasProdAudit = auditAfterProd.items?.some((i) => i.entity_id === prodRes.productId);
    assert(hasProdAudit, '1. Audit log created after product creation', `Items: ${JSON.stringify(auditAfterProd.items)}`);

    // --- TEST 2: Audit log created after stock adjustment ---
    const stockRes = await fetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: prodRes.productId, newStock: 50, notes: 'Inventory Audit Check' }),
    }).then((r) => r.json());

    const auditAfterStock = await fetch(`${API_BASE}/audit-logs?action=STOCK_ADJUSTMENT`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const hasStockAudit = auditAfterStock.items?.some((i) => i.entity_id === prodRes.productId);
    assert(hasStockAudit, '2. Audit log created after stock adjustment');

    // --- TEST 3: Audit log created after sale ---
    const saleRes = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        items: [{ productId: prodRes.productId, quantity: 2, unitPrice: 150 }],
        subtotal: 300,
        grandTotal: 300,
        paymentMethod: 'CASH',
      }),
    }).then((r) => r.json());

    const auditAfterSale = await fetch(`${API_BASE}/audit-logs?action=SALE_COMPLETED`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const hasSaleAudit = auditAfterSale.items?.some((i) => i.entity_id === saleRes.sale?.id);
    assert(hasSaleAudit, '3. Audit log created after sale');

    // --- TEST 4: Audit log created after expense ---
    const expenseRes = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Paper Bags', category: 'Supplies', amount: 45, paymentMethod: 'CASH' }),
    }).then((r) => r.json());

    const auditAfterExpense = await fetch(`${API_BASE}/audit-logs?action=EXPENSE_CREATED`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const hasExpenseAudit = auditAfterExpense.items?.some((i) => i.entity_id === expenseRes.expenseId);
    assert(hasExpenseAudit, '4. Audit log created after expense');

    // --- TEST 5: Audit logs are tenant isolated ---
    const auditLogsB = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    }).then((r) => r.json());

    const leakInB = auditLogsB.items?.some((i) => i.business_id === busIdA);
    assert(!leakInB, '5. Audit logs are tenant isolated');

    // --- TEST 6: CASHIER cannot access audit logs ---
    const cashierAuditReq = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenCashierA}` },
    });

    assert(cashierAuditReq.status === 403, '6. CASHIER cannot access audit logs (Status 403 Forbidden)', `Got status ${cashierAuditReq.status}`);

    // --- TEST 7: OWNER can access audit logs ---
    const ownerAuditReq = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert(ownerAuditReq.status === 200, '7. OWNER can access audit logs (Status 200 OK)');

    // --- TEST 8: Notification creation works ---
    const notifsRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const hasNotification = notifsRes.notifications && notifsRes.notifications.length > 0;
    assert(hasNotification, '8. Notification creation works', `Found ${notifsRes.notifications?.length || 0} notifications`);

    // --- TEST 9: Unread count works ---
    const unreadRes = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    assert(typeof unreadRes.unreadCount === 'number' && unreadRes.unreadCount > 0, '9. Unread count works', `Count: ${unreadRes.unreadCount}`);

    // --- TEST 10: Mark notification as read works ---
    const targetNotif = notifsRes.notifications[0];
    const markReadRes = await fetch(`${API_BASE}/notifications/${targetNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    const updatedUnread = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    assert(markReadRes.success && updatedUnread.unreadCount === unreadRes.unreadCount - 1, '10. Mark notification as read works');

    // --- TEST 11: Business A cannot access Business B notification ---
    const notifBRes = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    }).then((r) => r.json());

    const bHasANotif = notifBRes.notifications?.some((n) => n.id === targetNotif.id || n.business_id === busIdA);
    assert(!bHasANotif, '11. Business A cannot access Business B notification');

    // --- TEST 12: No sensitive credentials in audit metadata ---
    const allLogs = await fetch(`${API_BASE}/audit-logs?limit=100`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());

    let sensitiveFound = false;
    for (const log of allLogs.items || []) {
      const metaStr = JSON.stringify(log.metadata || {}).toLowerCase();
      if (metaStr.includes('password_hash') || metaStr.includes('secret') || metaStr.includes('password123')) {
        sensitiveFound = true;
        console.error('Found sensitive metadata in log:', log);
        break;
      }
    }

    assert(!sensitiveFound, '12. No sensitive credentials appear in audit metadata');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n===================================================');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED out of 12 tests`);
  console.log('===================================================');
}

runTests();
