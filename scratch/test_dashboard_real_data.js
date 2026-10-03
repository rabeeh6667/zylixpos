import Database from 'better-sqlite3';

async function runDashboardVerification() {
  console.log('================================================================================');
  console.log('    ZYLIX POS — DASHBOARD REAL DATA & DATE FILTERING VERIFICATION');
  console.log('================================================================================\n');

  const BASE_URL = 'http://localhost:5000/api';
  const db = new Database('./server/data/zylix.db');

  const timestamp = Date.now();
  const testResults = [];

  function record(testName, pass, details) {
    testResults.push({ testName, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${testName}`);
    console.log(`       -> ${details}\n`);
  }

  // 1. Authenticate Business A & Business B Owners
  const loginA = await (await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  })).json();
  const tokenA = loginA.token;
  const headersA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` };

  const loginB = await (await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  })).json();
  const tokenB = loginB.token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };

  // ----------------------------------------------------------------------------
  // TEST 1 & 2: FRESH STATE FOR BUSINESS A & B
  // ----------------------------------------------------------------------------
  const dashA_Fresh = await (await fetch(`${BASE_URL}/dashboard/stats?preset=today`, { headers: headersA })).json();
  const stA = dashA_Fresh.stats;

  const freshA_Pass = stA.totalSales === 0 && stA.totalOrders === 0 && stA.productsSold === 0 && stA.totalExpenses === 0 && stA.netProfit === 0;
  record('Fresh Business A Dashboard', freshA_Pass, `Total Sales: ₹${stA.totalSales}, Orders: ${stA.totalOrders}, Products Sold: ${stA.productsSold}, Expenses: ₹${stA.totalExpenses}, Profit: ₹${stA.netProfit}`);

  const dashB_Fresh = await (await fetch(`${BASE_URL}/dashboard/stats?preset=today`, { headers: headersB })).json();
  const stB = dashB_Fresh.stats;

  const freshB_Pass = stB.totalSales === 0 && stB.totalOrders === 0 && stB.productsSold === 0 && stB.totalExpenses === 0 && stB.netProfit === 0;
  record('Fresh Business B Dashboard', freshB_Pass, `Total Sales: ₹${stB.totalSales}, Orders: ${stB.totalOrders}, Products Sold: ${stB.productsSold}, Expenses: ₹${stB.totalExpenses}, Profit: ₹${stB.netProfit}`);

  // ----------------------------------------------------------------------------
  // TEST 3: DATE PRESET & FILTER CONTRACT
  // ----------------------------------------------------------------------------
  const datePresets = ['today', 'yesterday', '7days', '30days', 'this_month', 'last_month'];
  let presetsPass = true;
  for (const p of datePresets) {
    const res = await fetch(`${BASE_URL}/dashboard/stats?preset=${p}`, { headers: headersA });
    const data = await res.json();
    if (!res.ok || !data.periodLabel || !data.dateRange) {
      presetsPass = false;
    }
  }
  record('Date Selector API Presets', presetsPass, `Tested presets: ${datePresets.join(', ')}. All returned valid period labels and range boundaries.`);

  // ----------------------------------------------------------------------------
  // TEST 4: CONTROLLED TRANSACTION FINANCIAL CALCULATIONS
  // ----------------------------------------------------------------------------
  // Create Product: Selling ₹100, Purchase ₹60, Stock 20
  const prodRes = await (await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'Dashboard-Test-Product', purchasePrice: 60, sellingPrice: 100, currentStock: 20 })
  })).json();
  const pId = prodRes.productId;

  // Create Customer
  const custRes = await (await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'Dashboard-Test-Customer', phone: '9888877777' })
  })).json();
  const cId = custRes.customerId;

  // Perform Sale: 2 x ₹100 = ₹200
  const saleRes = await (await fetch(`${BASE_URL}/pos/checkout`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      customerId: cId,
      items: [{ productId: pId, quantity: 2, unitPrice: 100 }],
      subtotal: 200, discount: 0, tax: 0, grandTotal: 200,
      paymentMethod: 'CASH', amountReceived: 200
    })
  })).json();
  const sId = saleRes.sale.id;

  // Add Expense: ₹20
  const expRes = await (await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'Dashboard-Test-Expense', amount: 20, category: 'Supplies' })
  })).json();
  const eId = expRes.expenseId;

  // Fetch updated Business A dashboard
  const dashA_Active = await (await fetch(`${BASE_URL}/dashboard/stats?preset=today`, { headers: headersA })).json();
  const stAct = dashA_Active.stats;

  // Expected: Revenue = ₹200, Orders = 1, Products Sold = 2, COGS = ₹120, Expenses = ₹20, Profit = ₹60
  const isCalcCorrect = (
    stAct.totalSales === 200 &&
    stAct.totalOrders === 1 &&
    stAct.productsSold === 2 &&
    stAct.totalExpenses === 20 &&
    stAct.cogs === 120 &&
    stAct.netProfit === 60
  );
  record(
    'Financial Calculations Accuracy',
    isCalcCorrect,
    `Calculated -> Revenue: ₹${stAct.totalSales} (Exp: ₹200), Orders: ${stAct.totalOrders} (Exp: 1), Sold: ${stAct.productsSold} (Exp: 2), COGS: ₹${stAct.cogs} (Exp: ₹120), Expenses: ₹${stAct.totalExpenses} (Exp: ₹20), Net Profit: ₹${stAct.netProfit} (Exp: ₹60)`
  );

  // ----------------------------------------------------------------------------
  // TEST 5: DATE FILTERING ON ACTIVE TRANSACTION (YESTERDAY FILTER SHOULD BE 0)
  // ----------------------------------------------------------------------------
  const dashA_Yesterday = await (await fetch(`${BASE_URL}/dashboard/stats?preset=yesterday`, { headers: headersA })).json();
  const stYest = dashA_Yesterday.stats;
  const isYestZero = stYest.totalSales === 0 && stYest.totalOrders === 0 && stYest.netProfit === 0;
  record(
    'Date Range Filtering Accuracy',
    isYestZero,
    `Today's sale of ₹200 correctly excluded when 'Yesterday' filter selected -> Yesterday Sales: ₹${stYest.totalSales}, Orders: ${stYest.totalOrders}`
  );

  // ----------------------------------------------------------------------------
  // TEST 6: TENANT ISOLATION CHECK (BUSINESS B DASHBOARD REMAINS FRESH ZERO)
  // ----------------------------------------------------------------------------
  const dashB_Isolation = await (await fetch(`${BASE_URL}/dashboard/stats?preset=today`, { headers: headersB })).json();
  const stB_Iso = dashB_Isolation.stats;

  const bIsoPass = stB_Iso.totalSales === 0 && stB_Iso.totalOrders === 0 && stB_Iso.productsSold === 0 && stB_Iso.totalExpenses === 0 && stB_Iso.netProfit === 0;
  record(
    'Tenant Isolation on Dashboard Data',
    bIsoPass,
    `Business B Dashboard remained completely isolated during Business A transaction -> Today Sales: ₹${stB_Iso.totalSales}, Orders: ${stB_Iso.totalOrders}, Profit: ₹${stB_Iso.netProfit}`
  );

  // ----------------------------------------------------------------------------
  // CLEANUP TEST TRANSACTIONS TO RETURN TO 100% FRESH STATE
  // ----------------------------------------------------------------------------
  db.prepare('DELETE FROM payments WHERE sale_id = ?').run(sId);
  db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sId);
  db.prepare('DELETE FROM sales WHERE id = ?').run(sId);
  db.prepare('DELETE FROM inventory_transactions WHERE product_id = ?').run(pId);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(eId);
  db.prepare('DELETE FROM customers WHERE id = ?').run(cId);
  db.prepare('DELETE FROM products WHERE id = ?').run(pId);

  // Final confirmation of zero state
  const dashA_Final = await (await fetch(`${BASE_URL}/dashboard/stats?preset=today`, { headers: headersA })).json();
  const finalPass = dashA_Final.stats.totalSales === 0 && dashA_Final.stats.totalOrders === 0;
  record('Post-Test Cleanup to Fresh State', finalPass, 'Temporary test sale, expense, product & customer records removed. Returned to clean fresh state.');

  console.log('================================================================================');
  console.log(`SUMMARY: ${testResults.filter(r => r.pass).length} PASSED, ${testResults.filter(r => !r.pass).length} FAILED OUT OF ${testResults.length} DASHBOARD VERIFICATIONS.`);
  console.log('================================================================================\n');
}

runDashboardVerification().catch(console.error);
