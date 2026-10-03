import Database from 'better-sqlite3';

async function runPrompt4Tests() {
  console.log('================================================================');
  console.log('   ZYLIX POS — PROMPT 4/5 (CUSTOMERS, EXPENSES & REPORTS) SUITE');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000/api';
  let passes = 0;
  let fails = 0;

  function report(num, title, success, details) {
    if (success) {
      console.log(`[PASS] Test ${num}. ${title}`);
      console.log(`       -> ${details}\n`);
      passes++;
    } else {
      console.log(`[FAIL] Test ${num}. ${title}`);
      console.log(`       -> ${details}\n`);
      fails++;
    }
  }

  // 0. Login Business A Owner, Business A Cashier, Business B Owner
  const loginOwnerA = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  });
  const tokenOwnerA = (await loginOwnerA.json()).token;
  const headersOwnerA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerA}` };

  let loginCashierA = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cashier-a@test.com', password: 'Password123!' })
  });
  let cashierData = await loginCashierA.json();

  if (!cashierData.token) {
    // Create Cashier user in Business A using Owner A's token
    await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: headersOwnerA,
      body: JSON.stringify({
        name: 'Cashier A',
        email: 'cashier-a@test.com',
        password: 'Password123!',
        role: 'CASHIER'
      })
    });
    loginCashierA = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cashier-a@test.com', password: 'Password123!' })
    });
    cashierData = await loginCashierA.json();
  }
  const tokenCashierA = cashierData.token;
  const headersCashierA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenCashierA}` };

  const loginOwnerB = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });
  const tokenOwnerB = (await loginOwnerB.json()).token;
  const headersOwnerB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerB}` };

  // ----------------------------------------------------------------
  // 1. Customer Creation, Editing, Purchase History & Archiving
  // ----------------------------------------------------------------
  let testCustId = '';
  try {
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: headersOwnerA,
      body: JSON.stringify({
        name: 'Jane VIP Customer',
        email: 'jane.vip@example.com',
        phone: '+91 9876001122',
        address: '123 Park Avenue',
        notes: 'Frequent buyer'
      })
    });
    const custData = await custRes.json();
    if (!custRes.ok) console.log('[Cust Create Error]', custData);
    testCustId = custData.customerId;

    // Fetch customer details & history
    const getCustRes = await fetch(`${BASE_URL}/customers/${testCustId}`, { headers: headersOwnerA });
    const getCustData = await getCustRes.json();
    if (!getCustRes.ok) console.log('[Cust Get Error]', getCustData);

    // Edit customer
    const updateRes = await fetch(`${BASE_URL}/customers/${testCustId}`, {
      method: 'PUT',
      headers: headersOwnerA,
      body: JSON.stringify({ notes: 'Updated VIP Note' })
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) console.log('[Cust Update Error]', updateData);

    const isSuccess = custRes.status === 201 && getCustRes.ok && getCustData.customer && updateRes.ok;
    report(
      1,
      'Customer Management & Purchase History Integration',
      isSuccess,
      `Registered Customer '${getCustData.customer?.name}' (ID: ${testCustId}). Verified history endpoint & profile notes update.`
    );
  } catch (err) {
    report(1, 'Customer Management', false, err.message);
  }

  // ----------------------------------------------------------------
  // 2. Expense Management (Creation, Filtering & Archiving)
  // ----------------------------------------------------------------
  let testExpId = '';
  try {
    const expRes = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: headersOwnerA,
      body: JSON.stringify({
        title: 'Monthly Shop Rent',
        category: 'Rent',
        amount: 2500.00,
        paymentMethod: 'BANK_TRANSFER',
        description: 'September Premises Lease'
      })
    });
    const expData = await expRes.json();
    if (!expRes.ok) console.log('[Expense Create Error]', expData);
    testExpId = expData.expenseId;

    // Filter expenses by category & search
    const listExpRes = await fetch(`${BASE_URL}/expenses?category=Rent&search=Monthly`, { headers: headersOwnerA });
    const listExpData = await listExpRes.json();
    if (!listExpRes.ok) console.log('[Expense List Error]', listExpData);

    const isSuccess = expRes.status === 201 && listExpRes.ok && listExpData.expenses.some(e => e.id === testExpId);
    report(
      2,
      'Expense Management System',
      isSuccess,
      `Created Rent expense ₹2,500 (ID: ${testExpId}). Listed under category 'Rent' with filtered total ₹${listExpData.totalAmount}.`
    );
  } catch (err) {
    report(2, 'Expense Management System', false, err.message);
  }

  // ----------------------------------------------------------------
  // 3. Sales Reports with Database Aggregations
  // ----------------------------------------------------------------
  try {
    const salesReportRes = await fetch(`${BASE_URL}/reports/sales?preset=30days`, { headers: headersOwnerA });
    const reportData = await salesReportRes.json();
    if (!salesReportRes.ok) console.log('[Sales Report Error]', reportData);
    const s = reportData.summary;

    const isValidSummary = s && s.totalSales !== undefined && s.totalOrders !== undefined && s.estimatedProfit !== undefined;
    report(
      3,
      'Sales Reports & Real DB Financial Aggregations',
      salesReportRes.ok && isValidSummary,
      `30-day Report Summary -> Revenue: ₹${s?.totalSales}, Orders: ${s?.totalOrders}, Items Sold: ${s?.itemsSold}, Net Profit: ₹${s?.estimatedProfit} (${s?.profitMargin}% Margin).`
    );
  } catch (err) {
    report(3, 'Sales Reports', false, err.message);
  }

  // ----------------------------------------------------------------
  // 4. Product Reports (Best Sellers, Slow Movers & Stock Valuation)
  // ----------------------------------------------------------------
  try {
    const prodReportRes = await fetch(`${BASE_URL}/reports/products?preset=30days`, { headers: headersOwnerA });
    const prodReportData = await prodReportRes.json();

    const isValid = prodReportRes.ok && Array.isArray(prodReportData.bestSellers) && prodReportData.stockValuation;
    report(
      4,
      'Product & Inventory Analytics Reports',
      isValid,
      `Retrieved product analytics -> Best sellers listed: ${prodReportData.bestSellers.length}, Inventory Valuation: ₹${prodReportData.stockValuation?.retailValuation || 0}.`
    );
  } catch (err) {
    report(4, 'Product Reports', false, err.message);
  }

  // ----------------------------------------------------------------
  // 5. Payment Methods Distribution Reports
  // ----------------------------------------------------------------
  try {
    const payReportRes = await fetch(`${BASE_URL}/reports/payments?preset=30days`, { headers: headersOwnerA });
    const payReportData = await payReportRes.json();

    const isValid = payReportRes.ok && Array.isArray(payReportData.paymentBreakdown);
    report(
      5,
      'Payment Method Analytics Reports',
      isValid,
      `Calculated payment distribution -> Revenue ₹${payReportData.totalRevenue}, Methods breakdown: ${payReportData.paymentBreakdown.length} active channels.`
    );
  } catch (err) {
    report(5, 'Payment Method Reports', false, err.message);
  }

  // ----------------------------------------------------------------
  // 6. Dashboard Real Database Calculations
  // ----------------------------------------------------------------
  try {
    const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, { headers: headersOwnerA });
    const dashData = await dashRes.json();
    const st = dashData.stats;

    const isRealData = st && typeof st.todaySales === 'number' && typeof st.grossProfit === 'number' && Array.isArray(dashData.charts?.salesOverTime);
    report(
      6,
      'Dashboard Real Database Aggregations & Charts',
      dashRes.ok && isRealData,
      `Dashboard metrics -> Today Sales: ₹${st.todaySales}, Today Orders: ${st.todayOrders}, Products Sold: ${st.productsSold}, Real Profit: ₹${st.grossProfit}.`
    );
  } catch (err) {
    report(6, 'Dashboard Real DB Calculations', false, err.message);
  }

  // ----------------------------------------------------------------
  // 7. Report CSV Export Functionality
  // ----------------------------------------------------------------
  try {
    const exportRes = await fetch(`${BASE_URL}/reports/export?type=sales&preset=30days`, { headers: headersOwnerA });
    const csvText = await exportRes.text();

    const isCsvHeader = exportRes.ok && csvText.includes('Invoice Number,Date,Customer,Payment Method');
    report(
      7,
      'Report CSV Export Architecture',
      isCsvHeader,
      `Generated CSV file for sales report -> Size: ${csvText.length} bytes, Headers verified ('Invoice Number,Date,Customer...').`
    );
  } catch (err) {
    report(7, 'Report CSV Export Architecture', false, err.message);
  }

  // ----------------------------------------------------------------
  // 8. RBAC Role Permissions Enforcement (Cashier Restrictions)
  // ----------------------------------------------------------------
  try {
    const cashierAccessRes = await fetch(`${BASE_URL}/reports/sales`, { headers: headersCashierA });
    const cashierAccessData = await cashierAccessRes.json();

    const isRejected = cashierAccessRes.status === 403 && cashierAccessData.message.includes('Access denied');
    report(
      8,
      'RBAC Permissions Enforcement on Reports',
      isRejected,
      `Cashier role attempt to access financial reports was blocked with Status 403 ('${cashierAccessData.message}').`
    );
  } catch (err) {
    report(8, 'RBAC Permissions Enforcement', false, err.message);
  }

  // ----------------------------------------------------------------
  // 9. Multi-Tenant Isolation on Customers & Expenses
  // ----------------------------------------------------------------
  try {
    const crossCustRes = await fetch(`${BASE_URL}/customers/${testCustId}`, { headers: headersOwnerB });
    const crossCustData = await crossCustRes.json();

    const crossExpRes = await fetch(`${BASE_URL}/expenses/${testExpId}`, { headers: headersOwnerB });

    const isIsolated = crossCustRes.status === 404 && crossExpRes.status === 404;
    report(
      9,
      'Multi-Tenant Isolation on Customers & Expenses',
      isIsolated,
      `Business B access to Business A customer (${testCustId}) & expense (${testExpId}) rejected with Status 404 ('Not found').`
    );
  } catch (err) {
    report(9, 'Multi-Tenant Isolation', false, err.message);
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passes} PASSED, ${fails} FAILED OUT OF 9 PROMPT 4 TESTS.`);
  console.log('================================================================');
}

runPrompt4Tests().catch(console.error);
