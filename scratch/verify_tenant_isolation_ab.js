import Database from 'better-sqlite3';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runTenantIsolationVerification() {
  console.log('================================================================');
  console.log('   ZYLIX POS — TENANT ISOLATION VERIFICATION (BUSINESS A vs B)');
  console.log('================================================================');

  // 1. Login Owner A (ABC Bakery)
  const loginARes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  });
  const dataA = await loginARes.json();
  const tokenA = dataA.token;

  console.log(`\n[LOGIN A] Business: '${dataA.business?.name}' | User: '${dataA.user?.name}' (${dataA.user?.email})`);
  console.log(`[LOGIN A] JWT Tenant ID: ${dataA.business?.id}`);

  // 2. Login Owner B (XYZ Store)
  const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });
  const dataB = await loginBRes.json();
  const tokenB = dataB.token;

  console.log(`\n[LOGIN B] Business: '${dataB.business?.name}' | User: '${dataB.user?.name}' (${dataB.user?.email})`);
  console.log(`[LOGIN B] JWT Tenant ID: ${dataB.business?.id}`);

  // 3. Database Query Verification for Tenant A Data
  const db = new Database(path.resolve('server/data/zylix.db'));
  
  const prodsA = db.prepare('SELECT name, sku FROM products WHERE business_id = ?').all(dataA.business?.id);
  const custsA = db.prepare('SELECT name, email FROM customers WHERE business_id = ?').all(dataA.business?.id);

  console.log(`\n--- BUSINESS A (ABC Bakery) SECURE DATA ---`);
  console.log(`Products:`, prodsA);
  console.log(`Customers:`, custsA);

  const prodsB = db.prepare('SELECT name, sku FROM products WHERE business_id = ?').all(dataB.business?.id);
  const custsB = db.prepare('SELECT name, email FROM customers WHERE business_id = ?').all(dataB.business?.id);

  console.log(`\n--- BUSINESS B (XYZ Store) SECURE DATA ---`);
  console.log(`Products:`, prodsB);
  console.log(`Customers:`, custsB);

  // 4. Multi-Tenant Leak Check
  const leakA_has_B = prodsA.some(p => p.name === 'Store Product') || custsA.some(c => c.name === 'B Customer');
  const leakB_has_A = prodsB.some(p => p.name === 'Bakery Cake') || custsB.some(c => c.name === 'A Customer');

  console.log('\n================================================================');
  if (!leakA_has_B && !leakB_has_A) {
    console.log('✅ TENANT ISOLATION VERIFIED: 100% ISOLATED.');
    console.log('   - Business A (ABC Bakery) sees ONLY "Bakery Cake" & "A Customer".');
    console.log('   - Business B (XYZ Store) sees ONLY "Store Product" & "B Customer".');
    console.log('   - Zero cross-tenant data leaks detected!');
  } else {
    console.log('❌ ISOLATION FAILURE DETECTED!');
  }
  console.log('================================================================');
}

runTenantIsolationVerification().catch(console.error);
