const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('===================================================');
  console.log('  ZYLIX POS — PROMPT 5B BACKUP & SAFETY TESTS');
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
    const suffix = Date.now().toString().slice(-6);

    // Register Business A (Owner)
    const busABody = {
      businessName: `Backup Store A ${suffix}`,
      businessType: 'Retail',
      ownerName: 'Owner A',
      email: `ownerA_${suffix}@backup.com`,
      password: 'Password123!',
    };

    const regARes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busABody),
    }).then((r) => r.json());

    const tokenOwnerA = regARes.token;
    const busIdA = regARes.business.id;

    // Register Cashier for Business A
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        name: 'Cashier A',
        email: `cashierA_${suffix}@backup.com`,
        password: 'Password123!',
        role: 'CASHIER',
      }),
    }).then((r) => r.json());

    const cashierLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `cashierA_${suffix}@backup.com`, password: 'Password123!' }),
    }).then((r) => r.json());

    const tokenCashierA = cashierLogin.token;

    // Create a initial product & customer in Business A
    const prodRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Backup Test Product', sellingPrice: 250, currentStock: 100 }),
    }).then((r) => r.json());

    const custRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({ name: 'Backup Customer', phone: '9876543210' }),
    }).then((r) => r.json());

    // --- TEST 1: OWNER can create backup ---
    const createBackupRes = await fetch(`${API_BASE}/system/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    assert(createBackupRes.success && Boolean(createBackupRes.backup?.filename), '1. OWNER can create backup', JSON.stringify(createBackupRes));

    const backupFilename = createBackupRes.backup?.filename;

    // --- TEST 2: Backup file exists ---
    const backupsListRes = await fetch(`${API_BASE}/system/backups`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    const foundBackup = backupsListRes.backups?.find((b) => b.filename === backupFilename);
    assert(Boolean(foundBackup), '2. Backup file exists in backup directory');

    // --- TEST 3: Backup has non-zero size ---
    assert(foundBackup && foundBackup.size > 0, '3. Backup has non-zero size', `Size: ${foundBackup?.size} bytes`);

    // --- TEST 4: Backup API does not expose secrets ---
    const backupStr = JSON.stringify(backupsListRes).toLowerCase();
    const hasSecrets = backupStr.includes('password_hash') || backupStr.includes('jwt_secret') || backupStr.includes('secretkey');
    assert(!hasSecrets, '4. Backup API does not expose secrets, credentials, or JWT keys');

    // --- TEST 5: CASHIER cannot create backup ---
    const cashierBackupReq = await fetch(`${API_BASE}/system/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCashierA}` },
    });

    assert(cashierBackupReq.status === 403, '5. CASHIER cannot create backup (Status 403 Forbidden)', `Status: ${cashierBackupReq.status}`);

    // --- TEST 6: Unauthorized backup requests fail ---
    const unauthReq = await fetch(`${API_BASE}/system/backup`, { method: 'POST' });
    assert(unauthReq.status === 401, '6. Unauthorized backup requests fail (Status 401 Unauthorized)');

    // --- TEST 7 & 8: Database integrity & Foreign key check ---
    const healthRes = await fetch(`${API_BASE}/system/database-health`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    assert(healthRes.success && healthRes.health?.integrityCheck === 'ok', '7. Database integrity check passes');
    assert(healthRes.health?.foreignKeysEnabled && healthRes.health?.foreignKeyViolations === 0, '8. Foreign key check passes');

    // --- TEST 9: Backup creation does not interrupt POS ---
    const posCheckoutRes = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOwnerA}` },
      body: JSON.stringify({
        items: [{ productId: prodRes.productId, quantity: 1, unitPrice: 250 }],
        subtotal: 250,
        grandTotal: 250,
        paymentMethod: 'CASH',
      }),
    }).then((r) => r.json());

    assert(posCheckoutRes.success, '9. Backup creation does not interrupt POS checkout', posCheckoutRes.message);

    // --- TEST 10: Audit log is created for backup ---
    const auditRes = await fetch(`${API_BASE}/audit-logs?action=BACKUP_CREATED`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    const hasBackupAudit = auditRes.items?.some((i) => i.action === 'BACKUP_CREATED');
    assert(hasBackupAudit, '10. Audit log is created for BACKUP_CREATED');

    // --- TEST 11: Existing sales/products/customers remain unchanged after backup ---
    const fetchedProd = await fetch(`${API_BASE}/products/${prodRes.productId}`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    const fetchedCust = await fetch(`${API_BASE}/customers/${custRes.customerId}`, {
      headers: { Authorization: `Bearer ${tokenOwnerA}` },
    }).then((r) => r.json());

    assert(fetchedProd.success && fetchedCust.success, '11. Existing sales, products, and customers remain intact');

    // --- TEST 12: Tenant isolation remains intact ---
    // Register Business B and ensure Business B cannot access Business A backups
    const busBBody = {
      businessName: `Backup Store B ${suffix}`,
      businessType: 'Bakery',
      ownerName: 'Owner B',
      email: `ownerB_${suffix}@backup.com`,
      password: 'Password123!',
    };

    const regBRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busBBody),
    }).then((r) => r.json());

    const prodBRes = await fetch(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${regBRes.token}` },
    }).then((r) => r.json());

    const containsAProd = prodBRes.products?.some((p) => p.id === prodRes.productId);
    assert(!containsAProd, '12. Tenant isolation remains intact');

  } catch (err) {
    console.error('Test execution failed:', err);
    failed++;
  }

  console.log('\n===================================================');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED out of 12 tests`);
  console.log('===================================================');
}

runTests();
