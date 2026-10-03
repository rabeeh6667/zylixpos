async function runBackendSecurityTest() {
  console.log('================================================================');
  console.log('   ZYLIX POS — BACKEND API TENANT-ISOLATION SECURITY TEST');
  console.log('================================================================');

  const BASE_URL = 'http://localhost:5000/api';

  // 1. Authenticate as Owner B (owner-b@test.com - XYZ Store)
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });

  const loginData = await loginRes.json();
  const tokenB = loginData.token;
  const headersB = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenB}`
  };

  console.log(`[TEST SESSION] Authenticated User: '${loginData.user?.name}' (${loginData.user?.email})`);
  console.log(`[TEST SESSION] Tenant Context: '${loginData.business?.name}' (ID: ${loginData.business?.id})\n`);

  let passes = 0;
  let fails = 0;

  function assertTest(testNum, title, isPass, details) {
    if (isPass) {
      console.log(`[PASS] Test ${testNum}: ${title}`);
      console.log(`       Details: ${details}`);
      passes++;
    } else {
      console.log(`[FAIL] Test ${testNum}: ${title}`);
      console.log(`       Details: ${details}`);
      fails++;
    }
  }

  // --- TEST 1: Attempt to request Business A's products ---
  try {
    const listRes = await fetch(`${BASE_URL}/products`, { headers: headersB });
    const listData = await listRes.json();
    const hasCake = listData.products?.some(p => p.id === 'prod_bakery_cake' || p.name === 'Bakery Cake');
    
    const byIdRes = await fetch(`${BASE_URL}/products/prod_bakery_cake`, { headers: headersB });
    const byIdData = await byIdRes.json();

    const paramOverrideRes = await fetch(`${BASE_URL}/products?businessId=bus_abc_bakery`, { headers: headersB });
    const paramOverrideData = await paramOverrideRes.json();
    const paramHasCake = paramOverrideData.products?.some(p => p.name === 'Bakery Cake');

    const pass1 = !hasCake && byIdRes.status === 404 && !paramHasCake;
    assertTest(
      1,
      "Attempt to request Business A's products",
      pass1,
      `List check: Cake present=${hasCake}. Direct GET /products/prod_bakery_cake status=${byIdRes.status} (${byIdData.message}). Parameter override ignored=${!paramHasCake}.`
    );
  } catch (err) {
    assertTest(1, "Attempt to request Business A's products", false, err.message);
  }

  // --- TEST 2: Attempt to request Business A's customers ---
  try {
    const listRes = await fetch(`${BASE_URL}/customers`, { headers: headersB });
    const listData = await listRes.json();
    const hasCustomerA = listData.customers?.some(c => c.id === 'cust_a_customer' || c.name === 'A Customer');

    const byIdRes = await fetch(`${BASE_URL}/customers/cust_a_customer`, { headers: headersB });
    const byIdData = await byIdRes.json();

    const pass2 = !hasCustomerA && byIdRes.status === 404;
    assertTest(
      2,
      "Attempt to request Business A's customers",
      pass2,
      `List check: Customer A present=${hasCustomerA}. Direct GET /customers/cust_a_customer status=${byIdRes.status} (${byIdData.message}).`
    );
  } catch (err) {
    assertTest(2, "Attempt to request Business A's customers", false, err.message);
  }

  // --- TEST 3: Attempt to request Business A's sales ---
  try {
    const salesRes = await fetch(`${BASE_URL}/sales`, { headers: headersB });
    const salesData = await salesRes.json();
    const hasBusinessASales = salesData.sales?.some(s => s.business_id === 'bus_abc_bakery');

    const pass3 = salesRes.ok && !hasBusinessASales;
    assertTest(
      3,
      "Attempt to request Business A's sales",
      pass3,
      `GET /sales status=${salesRes.status}. Business A sales present=${hasBusinessASales}. Returned only XYZ Store sales.`
    );
  } catch (err) {
    assertTest(3, "Attempt to request Business A's sales", false, err.message);
  }

  // --- TEST 4: Attempt to modify a Business A record ---
  try {
    // Attempt 4a: Modify Business A product
    const modProdRes = await fetch(`${BASE_URL}/products/prod_bakery_cake`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'HACKED BAKERY CAKE', sellingPrice: 0.01 })
    });
    const modProdData = await modProdRes.json();

    // Attempt 4b: Modify Business A user
    const modUserRes = await fetch(`${BASE_URL}/users/user_owner_a`, {
      method: 'PATCH',
      headers: headersB,
      body: JSON.stringify({ name: 'HACKED OWNER A' })
    });
    const modUserData = await modUserRes.json();

    // Attempt 4c: Modify Business A customer
    const modCustRes = await fetch(`${BASE_URL}/customers/cust_a_customer`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'HACKED CUSTOMER A' })
    });
    const modCustData = await modCustRes.json();

    const pass4 = modProdRes.status === 404 && modUserRes.status === 404 && modCustRes.status === 404;
    assertTest(
      4,
      "Attempt to modify a Business A record",
      pass4,
      `PUT /products/prod_bakery_cake status=${modProdRes.status} (${modProdData.message}). PATCH /users/user_owner_a status=${modUserRes.status} (${modUserData.message}). PUT /customers/cust_a_customer status=${modCustRes.status} (${modCustData.message}).`
    );
  } catch (err) {
    assertTest(4, "Attempt to modify a Business A record", false, err.message);
  }

  // --- TEST 5: Attempt to delete/archive a Business A record ---
  try {
    // Attempt 5a: Delete Business A product
    const delProdRes = await fetch(`${BASE_URL}/products/prod_bakery_cake`, {
      method: 'DELETE',
      headers: headersB
    });
    const delProdData = await delProdRes.json();

    // Attempt 5b: Delete Business A user
    const delUserRes = await fetch(`${BASE_URL}/users/user_owner_a`, {
      method: 'DELETE',
      headers: headersB
    });
    const delUserData = await delUserRes.json();

    // Attempt 5c: Delete Business A customer
    const delCustRes = await fetch(`${BASE_URL}/customers/cust_a_customer`, {
      method: 'DELETE',
      headers: headersB
    });
    const delCustData = await delCustRes.json();

    const pass5 = delProdRes.status === 404 && delUserRes.status === 404 && delCustRes.status === 404;
    assertTest(
      5,
      "Attempt to delete/archive a Business A record",
      pass5,
      `DELETE /products/prod_bakery_cake status=${delProdRes.status} (${delProdData.message}). DELETE /users/user_owner_a status=${delUserRes.status} (${delUserData.message}). DELETE /customers/cust_a_customer status=${delCustRes.status} (${delCustData.message}).`
    );
  } catch (err) {
    assertTest(5, "Attempt to delete/archive a Business A record", false, err.message);
  }

  console.log('\n================================================================');
  console.log(`RESULT: ${passes} PASSED, ${fails} FAILED OUT OF 5 BACKEND SECURITY TESTS.`);
  console.log('================================================================');
}

runBackendSecurityTest().catch(console.error);
