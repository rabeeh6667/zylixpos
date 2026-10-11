import { initDb, query, queryOne, execute } from '../server/src/db/dbAdapter.ts';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../server/src/controllers/supplierController.ts';
import { translateSqlToPg } from '../server/src/db/pg.ts';

// Mock Express Request & Response
function createMockReqRes(options: {
  businessId?: string;
  user?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}) {
  const req: any = {
    businessId: options.businessId,
    user: options.user || { userId: 'usr_test_1', businessId: options.businessId, role: 'OWNER' },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
  };

  let statusCode = 200;
  let jsonResponse: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonResponse = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => jsonResponse,
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Supplier Management Integration Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Initialize Database
  console.log('\n[1] Initializing Database via dbAdapter...');
  await initDb();
  assert(true, 'dbAdapter initDb() completed successfully');

  const tenantA = 'bus_test_tenant_a';
  const tenantB = 'bus_test_tenant_b';

  // Ensure test businesses and users exist
  await execute('INSERT OR IGNORE INTO businesses (id, name, business_type) VALUES (?, ?, ?)', [tenantA, 'Tenant A Bakery', 'Bakery']);
  await execute('INSERT OR IGNORE INTO businesses (id, name, business_type) VALUES (?, ?, ?)', [tenantB, 'Tenant B Retail', 'Retail']);
  await execute('INSERT OR IGNORE INTO users (id, business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)', ['usr_test_1', tenantA, 'User A', 'usera@test.com', 'hash', 'OWNER']);
  await execute('INSERT OR IGNORE INTO users (id, business_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)', ['usr_test_2', tenantB, 'User B', 'userb@test.com', 'hash', 'OWNER']);

  // Clean previous test supplier entries for isolation test
  await execute('DELETE FROM suppliers WHERE business_id IN (?, ?)', [tenantA, tenantB]);

  // 2. Test Missing Business Context
  console.log('\n[2] Testing Missing Business Context...');
  {
    const { req, res, getStatus, getBody } = createMockReqRes({ businessId: undefined });
    await getSuppliers(req, res);
    assert(getStatus() === 401 && getBody().code === 'UNAUTHORIZED', 'getSuppliers rejects missing businessId with 401');

    const { req: reqC, res: resC, getStatus: getStatusC } = createMockReqRes({ businessId: undefined, body: { name: 'Supplier' } });
    await createSupplier(reqC, resC);
    assert(getStatusC() === 401, 'createSupplier rejects missing businessId with 401');

    const { req: reqU, res: resU, getStatus: getStatusU } = createMockReqRes({ businessId: undefined, params: { id: 's1' }, body: { name: 'New' } });
    await updateSupplier(reqU, resU);
    assert(getStatusU() === 401, 'updateSupplier rejects missing businessId with 401');

    const { req: reqD, res: resD, getStatus: getStatusD } = createMockReqRes({ businessId: undefined, params: { id: 's1' } });
    await deleteSupplier(reqD, resD);
    assert(getStatusD() === 401, 'deleteSupplier rejects missing businessId with 401');
  }

  // 3. Test Input Validation
  console.log('\n[3] Testing Input Validation...');
  {
    const { req, res, getStatus } = createMockReqRes({
      businessId: tenantA,
      body: { name: 'X' }, // Name too short
    });
    await createSupplier(req, res);
    assert(getStatus() === 400, 'createSupplier rejects name shorter than 2 chars');

    const { req: reqMail, res: resMail, getStatus: getStatusMail } = createMockReqRes({
      businessId: tenantA,
      body: { name: 'Valid Name', email: 'invalid-email-format' },
    });
    await createSupplier(reqMail, resMail);
    assert(getStatusMail() === 400, 'createSupplier rejects invalid email format');

    const { req: reqEmpty, res: resEmpty, getStatus: getStatusEmpty } = createMockReqRes({
      businessId: tenantA,
      params: { id: 'some_id' },
      body: {}, // No fields to update
    });
    await updateSupplier(reqEmpty, resEmpty);
    // Non-existent id returns 404 or 400
    assert(getStatusEmpty() === 404 || getStatusEmpty() === 400, 'updateSupplier rejects empty or invalid update');
  }

  // 4. Test CRUD Operations
  console.log('\n[4] Testing CRUD Operations...');
  let createdSupplierAId = '';
  {
    // Create Supplier for Tenant A
    const { req, res, getStatus, getBody } = createMockReqRes({
      businessId: tenantA,
      body: {
        name: 'Dairy Express Ltd',
        contactPerson: 'Rajesh Kumar',
        phone: '+91 9876543210',
        email: 'orders@dairyexpress.in',
        category: 'Dairy & Beverages',
        address: 'Plot 44, APMC Market',
      },
    });
    await createSupplier(req, res);
    const body = getBody();
    assert(getStatus() === 201 && body.success && body.supplier?.id, 'createSupplier creates supplier and returns 201');
    createdSupplierAId = body.supplier.id;
    assert(body.supplier.name === 'Dairy Express Ltd', 'createSupplier stores correct name');
    assert(body.supplier.status === 'ACTIVE', 'createSupplier defaults status to ACTIVE');

    // Retrieve by ID
    const { req: reqGet, res: resGet, getStatus: getStatusGet, getBody: getBodyGet } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierAId },
    });
    await getSupplierById(reqGet, resGet);
    assert(getStatusGet() === 200 && getBodyGet().supplier?.id === createdSupplierAId, 'getSupplierById returns supplier');

    // List Suppliers
    const { req: reqList, res: resList, getStatus: getStatusList, getBody: getBodyList } = createMockReqRes({
      businessId: tenantA,
    });
    await getSuppliers(reqList, resList);
    assert(getStatusList() === 200 && getBodyList().count === 1, 'getSuppliers returns tenant suppliers');

    // Search filter
    const { req: reqSearch, res: resSearch, getBody: getBodySearch } = createMockReqRes({
      businessId: tenantA,
      query: { search: 'Express' },
    });
    await getSuppliers(reqSearch, resSearch);
    assert(getBodySearch().count === 1, 'getSuppliers search filter finds matching name');

    // Category filter
    const { req: reqCat, res: resCat, getBody: getBodyCat } = createMockReqRes({
      businessId: tenantA,
      query: { category: 'Dairy & Beverages' },
    });
    await getSuppliers(reqCat, resCat);
    assert(getBodyCat().count === 1, 'getSuppliers category filter matches');

    // Update Supplier
    const { req: reqUp, res: resUp, getStatus: getStatusUp, getBody: getBodyUp } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierAId },
      body: {
        contactPerson: 'Rajesh K. Sharma',
        phone: '+91 9998887776',
      },
    });
    await updateSupplier(reqUp, resUp);
    assert(getStatusUp() === 200 && getBodyUp().supplier?.contact_person === 'Rajesh K. Sharma', 'updateSupplier updates supplier fields');
    assert(getBodyUp().supplier?.phone === '+91 9998887776', 'updateSupplier updates phone number');
  }

  // 5. Test Cross-Tenant Isolation
  console.log('\n[5] Testing Cross-Tenant Isolation...');
  let createdSupplierBId = '';
  {
    // Create Supplier for Tenant B
    const { req: reqB, res: resB, getBody: getBodyB } = createMockReqRes({
      businessId: tenantB,
      body: {
        name: 'Hardware Wholesalers Co',
        contactPerson: 'Sunil Verma',
        category: 'Hardware',
      },
    });
    await createSupplier(reqB, resB);
    createdSupplierBId = getBodyB().supplier.id;
    assert(Boolean(createdSupplierBId), 'Tenant B supplier created');

    // Tenant A attempts to list suppliers - MUST NOT see Tenant B's supplier
    const { req: reqListA, res: resListA, getBody: getBodyListA } = createMockReqRes({
      businessId: tenantA,
    });
    await getSuppliers(reqListA, resListA);
    const tenantASupplierIds = getBodyListA().suppliers.map((s: any) => s.id);
    assert(!tenantASupplierIds.includes(createdSupplierBId), 'Tenant A cannot see Tenant B supplier in list');

    // Tenant A attempts to get Tenant B's supplier by ID - MUST return 404
    const { req: reqCrossGet, res: resCrossGet, getStatus: getStatusCrossGet } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierBId },
    });
    await getSupplierById(reqCrossGet, resCrossGet);
    assert(getStatusCrossGet() === 404, 'Tenant A cannot read Tenant B supplier by ID (404)');

    // Tenant A attempts to update Tenant B's supplier - MUST return 404
    const { req: reqCrossUp, res: resCrossUp, getStatus: getStatusCrossUp } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierBId },
      body: { name: 'Hacked by Tenant A' },
    });
    await updateSupplier(reqCrossUp, resCrossUp);
    assert(getStatusCrossUp() === 404, 'Tenant A cannot update Tenant B supplier (404)');

    // Verify Tenant B's supplier was NOT modified
    const { req: reqVerifyB, res: resVerifyB, getBody: getBodyVerifyB } = createMockReqRes({
      businessId: tenantB,
      params: { id: createdSupplierBId },
    });
    await getSupplierById(reqVerifyB, resVerifyB);
    assert(getBodyVerifyB().supplier.name === 'Hardware Wholesalers Co', 'Tenant B supplier remains unmodified after attack');

    // Tenant A attempts to delete Tenant B's supplier - MUST return 404
    const { req: reqCrossDel, res: resCrossDel, getStatus: getStatusCrossDel } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierBId },
    });
    await deleteSupplier(reqCrossDel, resCrossDel);
    assert(getStatusCrossDel() === 404, 'Tenant A cannot delete Tenant B supplier (404)');

    // Verify Tenant B's supplier still exists
    const { req: reqCheckB, res: resCheckB, getStatus: getStatusCheckB } = createMockReqRes({
      businessId: tenantB,
      params: { id: createdSupplierBId },
    });
    await getSupplierById(reqCheckB, resCheckB);
    assert(getStatusCheckB() === 200, 'Tenant B supplier still exists after unauthorized delete attempt');
  }

  // 6. Test Delete Operation
  console.log('\n[6] Testing Delete Operation...');
  {
    // Tenant A deletes its own supplier
    const { req: reqDel, res: resDel, getStatus: getStatusDel } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierAId },
    });
    await deleteSupplier(reqDel, resDel);
    assert(getStatusDel() === 200, 'Tenant A successfully deletes its own supplier');

    // Verify supplier is gone
    const { req: reqAfter, res: resAfter, getStatus: getStatusAfter } = createMockReqRes({
      businessId: tenantA,
      params: { id: createdSupplierAId },
    });
    await getSupplierById(reqAfter, resAfter);
    assert(getStatusAfter() === 404, 'Deleted supplier returns 404 upon retrieval');
  }

  // 7. Verify Audit Logs
  console.log('\n[7] Verifying Audit Logs...');
  {
    const auditLogs = await query(
      'SELECT * FROM audit_logs WHERE business_id = ? AND entity = ? ORDER BY created_at ASC',
      [tenantA, 'supplier']
    );
    const actions = auditLogs.map((l: any) => l.action);
    assert(actions.includes('CREATE'), 'Audit log contains CREATE event');
    assert(actions.includes('UPDATE'), 'Audit log contains UPDATE event');
    assert(actions.includes('DELETE'), 'Audit log contains DELETE event');
  }

  // 8. Test PostgreSQL SQL Translation
  console.log('\n[8] Testing PostgreSQL SQL Translation Engine...');
  {
    const inputSql = 'SELECT * FROM suppliers WHERE business_id = ? AND status = ?';
    const translated = translateSqlToPg(inputSql);
    assert(translated === 'SELECT * FROM suppliers WHERE business_id = $1 AND status = $2', 'translateSqlToPg converts ? to $1, $2');

    const dateSql = 'SELECT * FROM suppliers WHERE date(created_at, "localtime") >= date(?)';
    const dateTranslated = translateSqlToPg(dateSql);
    assert(dateTranslated.includes('::date'), 'translateSqlToPg converts date() to ::date');
  }

  // Cleanup test records
  await execute('DELETE FROM suppliers WHERE business_id IN (?, ?)', [tenantA, tenantB]);
  await execute('DELETE FROM audit_logs WHERE business_id IN (?, ?)', [tenantA, tenantB]);
  await execute('DELETE FROM users WHERE id IN (?, ?)', ['usr_test_1', 'usr_test_2']);
  await execute('DELETE FROM businesses WHERE id IN (?, ?)', [tenantA, tenantB]);

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
