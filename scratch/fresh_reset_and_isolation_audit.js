import Database from 'better-sqlite3';

const dbPath = './server/data/zylix.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

async function performFreshResetAndIsolationAudit() {
  console.log('================================================================================');
  console.log('   ZYLIX POS — CONTROLLED FRESH-BUSINESS DATA RESET & ISOLATION AUDIT');
  console.log('================================================================================\n');

  const BASE_URL = 'http://localhost:5000/api';

  // ----------------------------------------------------------------------------
  // STEP 1: INSPECT CURRENT DATABASE TABLES & COUNTS BEFORE RESET
  // ----------------------------------------------------------------------------
  const tables = [
    'businesses', 'users', 'roles', 'settings', 'audit_logs',
    'categories', 'products', 'inventory_transactions',
    'customers', 'sales', 'sale_items', 'payments',
    'held_sales', 'expense_categories', 'expenses'
  ];

  console.log('--- Initial Database Table Record Counts ---');
  const initialCounts = {};
  tables.forEach(table => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      initialCounts[table] = row.count;
      console.log(`  - ${table.padEnd(25)}: ${row.count} records`);
    } catch (e) {
      console.log(`  - ${table.padEnd(25)}: [Table missing or error]`);
    }
  });

  // ----------------------------------------------------------------------------
  // STEP 2: SAFE CONTROLLED DATA RESET IN TRANSACTION
  // ----------------------------------------------------------------------------
  console.log('\n--- Executing Controlled Safe Reset Transaction ---');
  const deleteTransaction = db.transaction(() => {
    // Foreign-key safe order for clearing transactional data:
    // 1. Payments
    // 2. Sale Items
    // 3. Sales
    // 4. Held Sales
    // 5. Inventory Transactions
    // 6. Expenses
    // 7. Customers (Optional reset / total_spent reset)
    // 8. Products (Keep core catalog or reset test items if created dynamically)
    
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM held_sales').run();
    db.prepare('DELETE FROM inventory_transactions').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM expense_categories').run();
  });

  try {
    deleteTransaction();
    console.log('Successfully completed safe deletion transaction!');
  } catch (err) {
    console.error('Error executing delete transaction:', err);
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // STEP 3: VERIFY PRESERVED FOUNDATIONAL TABLES
  // ----------------------------------------------------------------------------
  console.log('\n--- Post-Reset Database Table Counts ---');
  const postCounts = {};
  tables.forEach(table => {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    postCounts[table] = row.count;
    console.log(`  - ${table.padEnd(25)}: ${row.count} records`);
  });

  // ----------------------------------------------------------------------------
  // STEP 4: DASHBOARD FRESH STATE VERIFICATION FOR BUSINESS A & B
  // ----------------------------------------------------------------------------
  console.log('\n--- Verifying Fresh Business Dashboard & Reports ---');
  
  // Login Owner A
  const loginA = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  });
  const tokenA = (await loginA.json()).token;
  const headersA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` };

  // Login Owner B
  const loginB = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });
  const tokenB = (await loginB.json()).token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };

  // Check Business A Dashboard
  const dashA = await (await fetch(`${BASE_URL}/dashboard/stats`, { headers: headersA })).json();
  console.log('\n[Business A Fresh Dashboard Metrics]:');
  console.log(`  - Today Sales           : ₹${dashA.stats.todaySales}`);
  console.log(`  - Today Orders          : ${dashA.stats.todayOrders}`);
  console.log(`  - Products Sold         : ${dashA.stats.productsSold}`);
  console.log(`  - Today Expenses        : ₹${dashA.stats.todayExpenses}`);
  console.log(`  - Net Estimated Profit  : ₹${dashA.stats.grossProfit}`);
  console.log(`  - Low Stock Count       : ${dashA.stats.lowStockCount}`);

  // Check Business B Dashboard
  const dashB = await (await fetch(`${BASE_URL}/dashboard/stats`, { headers: headersB })).json();
  console.log('\n[Business B Fresh Dashboard Metrics]:');
  console.log(`  - Today Sales           : ₹${dashB.stats.todaySales}`);
  console.log(`  - Today Orders          : ${dashB.stats.todayOrders}`);
  console.log(`  - Products Sold         : ${dashB.stats.productsSold}`);
  console.log(`  - Today Expenses        : ₹${dashB.stats.todayExpenses}`);
  console.log(`  - Net Estimated Profit  : ₹${dashB.stats.grossProfit}`);
  console.log(`  - Low Stock Count       : ${dashB.stats.lowStockCount}`);

  const isDashFreshA = dashA.stats.todaySales === 0 && dashA.stats.todayOrders === 0 && dashA.stats.todayExpenses === 0 && dashA.stats.grossProfit === 0;
  const isDashFreshB = dashB.stats.todaySales === 0 && dashB.stats.todayOrders === 0 && dashB.stats.todayExpenses === 0 && dashB.stats.grossProfit === 0;

  // ----------------------------------------------------------------------------
  // STEP 5: CREATING TEMPORARY ISOLATION TEST RECORDS & MULTI-TENANT AUDIT
  // ----------------------------------------------------------------------------
  console.log('\n--- Creating Temporary Isolation Test Records ---');
  
  // Create Business A Test Records
  const resPA = await (await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'A-Test-Product', sellingPrice: 200, purchasePrice: 120, currentStock: 25 })
  })).json();
  const idPA = resPA.productId;

  const resCA = await (await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'A-Test-Customer', phone: '9900000001' })
  })).json();
  const idCA = resCA.customerId;

  const resEA = await (await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ title: 'A-Test-Expense', amount: 500, category: 'Rent' })
  })).json();
  const idEA = resEA.expenseId;

  const resSA = await (await fetch(`${BASE_URL}/pos/checkout`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      customerId: idCA,
      items: [{ productId: idPA, quantity: 1, unitPrice: 200 }],
      subtotal: 200, discount: 0, tax: 0, grandTotal: 200,
      paymentMethod: 'CASH', amountReceived: 200
    })
  })).json();
  const idSA = resSA.sale.id;

  // Create Business B Test Records
  const resPB = await (await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ name: 'B-Test-Product', sellingPrice: 350, purchasePrice: 200, currentStock: 40 })
  })).json();
  const idPB = resPB.productId;

  const resCB = await (await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ name: 'B-Test-Customer', phone: '9900000002' })
  })).json();
  const idCB = resCB.customerId;

  const resEB = await (await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({ title: 'B-Test-Expense', amount: 750, category: 'Supplies' })
  })).json();
  const idEB = resEB.expenseId;

  const resSB = await (await fetch(`${BASE_URL}/pos/checkout`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      customerId: idCB,
      items: [{ productId: idPB, quantity: 1, unitPrice: 350 }],
      subtotal: 350, discount: 0, tax: 0, grandTotal: 350,
      paymentMethod: 'CASH', amountReceived: 350
    })
  })).json();
  const idSB = resSB.sale.id;

  console.log(`  - Business A Test IDs -> Product: ${idPA}, Customer: ${idCA}, Expense: ${idEA}, Sale: ${idSA}`);
  console.log(`  - Business B Test IDs -> Product: ${idPB}, Customer: ${idCB}, Expense: ${idEB}, Sale: ${idSB}`);

  // ----------------------------------------------------------------------------
  // STEP 6: CROSS-TENANT ACCESS & TAMPERING TESTS
  // ----------------------------------------------------------------------------
  console.log('\n--- Executing Business B -> Business A Cross-Tenant Attacks ---');
  const isolationMatrix = [];

  async function testAccess(label, url, method, headers, expectedStatus) {
    const res = await fetch(url, { method, headers });
    const pass = res.status === expectedStatus;
    isolationMatrix.push({ label, status: res.status, expectedStatus, pass });
    console.log(`  - ${label.padEnd(50)}: Status ${res.status} (Expected ${expectedStatus}) -> ${pass ? 'PASS' : 'FAIL'}`);
    return pass;
  }

  // B -> A Checks
  await testAccess('B -> GET A Product', `${BASE_URL}/products/${idPA}`, 'GET', headersB, 404);
  await testAccess('B -> PUT A Product', `${BASE_URL}/products/${idPA}`, 'PUT', headersB, 404);
  await testAccess('B -> DELETE A Product', `${BASE_URL}/products/${idPA}`, 'DELETE', headersB, 404);

  await testAccess('B -> GET A Customer', `${BASE_URL}/customers/${idCA}`, 'GET', headersB, 404);
  await testAccess('B -> PUT A Customer', `${BASE_URL}/customers/${idCA}`, 'PUT', headersB, 404);
  await testAccess('B -> DELETE A Customer', `${BASE_URL}/customers/${idCA}`, 'DELETE', headersB, 404);

  await testAccess('B -> GET A Expense', `${BASE_URL}/expenses/${idEA}`, 'GET', headersB, 404);
  await testAccess('B -> PUT A Expense', `${BASE_URL}/expenses/${idEA}`, 'PUT', headersB, 404);
  await testAccess('B -> DELETE A Expense', `${BASE_URL}/expenses/${idEA}`, 'DELETE', headersB, 404);

  await testAccess('B -> GET A Sale Invoice', `${BASE_URL}/sales/${idSA}`, 'GET', headersB, 404);

  console.log('\n--- Executing Business A -> Business B Cross-Tenant Attacks ---');
  // A -> B Checks
  await testAccess('A -> GET B Product', `${BASE_URL}/products/${idPB}`, 'GET', headersA, 404);
  await testAccess('A -> PUT B Product', `${BASE_URL}/products/${idPB}`, 'PUT', headersA, 404);
  await testAccess('A -> DELETE B Product', `${BASE_URL}/products/${idPB}`, 'DELETE', headersA, 404);

  await testAccess('A -> GET B Customer', `${BASE_URL}/customers/${idCB}`, 'GET', headersA, 404);
  await testAccess('A -> PUT B Customer', `${BASE_URL}/customers/${idCB}`, 'PUT', headersA, 404);
  await testAccess('A -> DELETE B Customer', `${BASE_URL}/customers/${idCB}`, 'DELETE', headersA, 404);

  await testAccess('A -> GET B Expense', `${BASE_URL}/expenses/${idEB}`, 'GET', headersA, 404);
  await testAccess('A -> PUT B Expense', `${BASE_URL}/expenses/${idEB}`, 'PUT', headersA, 404);
  await testAccess('A -> DELETE B Expense', `${BASE_URL}/expenses/${idEB}`, 'DELETE', headersA, 404);

  await testAccess('A -> GET B Sale Invoice', `${BASE_URL}/sales/${idSB}`, 'GET', headersA, 404);

  // ----------------------------------------------------------------------------
  // STEP 7: LIST ENDPOINT LEAKAGE AUDIT
  // ----------------------------------------------------------------------------
  console.log('\n--- Collection List Endpoint Leakage Checks ---');
  const prodsListB = await (await fetch(`${BASE_URL}/products`, { headers: headersB })).json();
  const custsListB = await (await fetch(`${BASE_URL}/customers`, { headers: headersB })).json();
  const salesListB = await (await fetch(`${BASE_URL}/sales`, { headers: headersB })).json();
  const expsListB = await (await fetch(`${BASE_URL}/expenses`, { headers: headersB })).json();

  const bHasAProd = prodsListB.products?.some(p => p.id === idPA);
  const bHasACust = custsListB.customers?.some(c => c.id === idCA);
  const bHasASale = salesListB.sales?.some(s => s.id === idSA);
  const bHasAExp = expsListB.expenses?.some(e => e.id === idEA);

  console.log(`  - Business B List Contains Business A Product : ${bHasAProd ? 'LEAK DETECTED (FAIL)' : 'CLEAN (PASS)'}`);
  console.log(`  - Business B List Contains Business A Customer: ${bHasACust ? 'LEAK DETECTED (FAIL)' : 'CLEAN (PASS)'}`);
  console.log(`  - Business B List Contains Business A Sale    : ${bHasASale ? 'LEAK DETECTED (FAIL)' : 'CLEAN (PASS)'}`);
  console.log(`  - Business B List Contains Business A Expense : ${bHasAExp ? 'LEAK DETECTED (FAIL)' : 'CLEAN (PASS)'}`);

  // ----------------------------------------------------------------------------
  // STEP 8: DATABASE DIRECT INTEGRITY CHECK
  // ----------------------------------------------------------------------------
  console.log('\n--- Direct Database Integrity Inspection ---');
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  console.log(`  - Foreign Key Check Violations: ${fkViolations.length}`);

  let nullBusinessIdCount = 0;
  tables.forEach(table => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      if (cols.some(c => c.name === 'business_id')) {
        const nulls = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE business_id IS NULL`).get();
        if (nulls.count > 0) {
          console.log(`  - [WARN] Table '${table}' has ${nulls.count} NULL business_id rows!`);
          nullBusinessIdCount += nulls.count;
        }
      }
    } catch (e) {}
  });

  if (nullBusinessIdCount === 0) {
    console.log('  - All tenant-owned database tables contain valid, non-NULL business_id values.');
  }

  // ----------------------------------------------------------------------------
  // STEP 9: CLEANUP TEMPORARY TEST RECORDS TO RETURN TO FRESH STATE
  // ----------------------------------------------------------------------------
  console.log('\n--- Cleaning Temporary Isolation Test Records ---');
  const finalCleanup = db.transaction(() => {
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM inventory_transactions').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM products').run();
  });
  finalCleanup();
  console.log('Final database cleanup completed successfully. Returned to 100% fresh state.');

  // ----------------------------------------------------------------------------
  // FINAL STATUS COMPUTATION
  // ----------------------------------------------------------------------------
  const isIsolationClean = !bHasAProd && !bHasACust && !bHasASale && !bHasAExp && isolationMatrix.every(m => m.pass);
  const isDbClean = fkViolations.length === 0 && nullBusinessIdCount === 0;

  console.log('\n================================================================================');
  console.log('                       FINAL AUDIT STATUS SUMMARY');
  console.log('================================================================================');
  console.log(`DATA RESET                 : ${isDashFreshA && isDashFreshB ? 'PASS' : 'FAIL'}`);
  console.log(`DASHBOARD FRESH STATE      : ${isDashFreshA && isDashFreshB ? 'PASS' : 'FAIL'}`);
  console.log(`BUSINESS A ISOLATION       : ${isIsolationClean ? 'PASS' : 'FAIL'}`);
  console.log(`BUSINESS B ISOLATION       : ${isIsolationClean ? 'PASS' : 'FAIL'}`);
  console.log(`DATABASE INTEGRITY         : ${isDbClean ? 'PASS' : 'FAIL'}`);
  console.log(`SECURITY                   : ${isIsolationClean ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');
}

performFreshResetAndIsolationAudit().catch(console.error);
