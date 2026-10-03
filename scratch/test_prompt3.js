async function runPrompt3Tests() {
  console.log('================================================================');
  console.log('   ZYLIX POS — PROMPT 3/5 (POS BILLING & SALES) TEST SUITE');
  console.log('================================================================');

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

  // Login Owner A (owner-a@test.com - ABC Bakery) & Owner B (owner-b@test.com - XYZ Store)
  const loginARes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  });
  const dataA = await loginARes.json();
  const tokenA = dataA.token;
  const headersA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` };

  const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });
  const dataB = await loginBRes.json();
  const tokenB = dataB.token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };

  // Setup Test Product for ABC Bakery with Stock = 10
  const prodBarcode = `POS${Date.now()}`;
  const createProdRes = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'POS Test Bagel',
      sellingPrice: 5.00,
      currentStock: 10,
      minimumStock: 2,
      barcode: prodBarcode
    })
  });
  const testProdId = (await createProdRes.json()).productId;

  // 1. Complete Sale Workflow (Stock 10 -> Sale Qty 2 -> Expected Stock 8)
  let completedSaleId = '';
  let invoiceNumber = '';
  const testIdempotencyKey = `idem-${Date.now()}`;

  try {
    const checkoutRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: testProdId, quantity: 2, unitPrice: 5.00, discount: 0, tax: 0 }],
        subtotal: 10.00,
        discount: 0,
        tax: 0,
        grandTotal: 10.00,
        amountReceived: 15.00,
        paymentMethod: 'CASH',
        idempotencyKey: testIdempotencyKey
      })
    });
    const checkoutData = await checkoutRes.json();
    completedSaleId = checkoutData.sale?.id;
    invoiceNumber = checkoutData.sale?.invoiceNumber || checkoutData.sale?.invoice_number;

    // Fetch product to verify stock deducted from 10 to 8
    const checkProdRes = await fetch(`${BASE_URL}/products/${testProdId}`, { headers: headersA });
    const checkProdData = await checkProdRes.json();
    const updatedStock = checkProdData.product?.current_stock;
    const hasSaleTx = checkProdData.inventoryHistory?.some(h => h.transaction_type === 'SALE' && h.quantity === -2);

    report(
      1,
      'Complete Sale Workflow (Atomic Stock Deduction)',
      checkoutRes.status === 201 && updatedStock === 8 && hasSaleTx,
      `Invoice #${invoiceNumber} created. Stock deducted from 10 to ${updatedStock}. Inventory 'SALE' transaction logged.`
    );
  } catch (err) {
    report(1, 'Complete Sale Workflow (Atomic Stock Deduction)', false, err.message);
  }

  // 2. Insufficient Stock Prevention
  try {
    // Attempt to buy 50 units when stock is 8
    const overflowRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: testProdId, quantity: 50, unitPrice: 5.00 }],
        subtotal: 250.00,
        grandTotal: 250.00,
        paymentMethod: 'CASH'
      })
    });
    const overflowData = await overflowRes.json();

    // Verify stock remains 8
    const checkProdRes = await fetch(`${BASE_URL}/products/${testProdId}`, { headers: headersA });
    const stockAfterRejection = (await checkProdRes.json()).product?.current_stock;

    report(
      2,
      'Insufficient Stock Prevention',
      overflowRes.status === 400 && stockAfterRejection === 8,
      `Checkout rejected with Status ${overflowRes.status} ('${overflowData.message}'). Stock untouched at ${stockAfterRejection}.`
    );
  } catch (err) {
    report(2, 'Insufficient Stock Prevention', false, err.message);
  }

  // 3. Invalid Product Prevention
  try {
    const invalidProdRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: 'invalid_prod_9999', quantity: 1, unitPrice: 10.00 }],
        subtotal: 10.00,
        grandTotal: 10.00,
        paymentMethod: 'CASH'
      })
    });
    const invalidData = await invalidProdRes.json();
    report(
      3,
      'Invalid Product Prevention',
      invalidProdRes.status === 400 && !invalidData.success,
      `Rejected invalid product ID with Status ${invalidProdRes.status} ('${invalidData.message}')`
    );
  } catch (err) {
    report(3, 'Invalid Product Prevention', false, err.message);
  }

  // 4. Idempotency / Duplicate Request Protection
  try {
    const duplicateRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: testProdId, quantity: 2, unitPrice: 5.00 }],
        subtotal: 10.00,
        grandTotal: 10.00,
        paymentMethod: 'CASH',
        idempotencyKey: testIdempotencyKey // Re-submitting same key!
      })
    });
    const dupData = await duplicateRes.json();

    // Verify stock remains 8 (NOT deducted again to 6)
    const checkProdRes = await fetch(`${BASE_URL}/products/${testProdId}`, { headers: headersA });
    const stockAfterDup = (await checkProdRes.json()).product?.current_stock;

    report(
      4,
      'Idempotency Protection (Duplicate Checkout Guard)',
      duplicateRes.ok && dupData.isDuplicatePrevented && stockAfterDup === 8,
      `Duplicate request intercepted. Original sale returned. Stock remained ${stockAfterDup} without double-charging!`
    );
  } catch (err) {
    report(4, 'Idempotency Protection', false, err.message);
  }

  // 5. Hold & Resume Sale Workflow
  let heldId = '';
  try {
    const holdRes = await fetch(`${BASE_URL}/pos/hold`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        cartJson: JSON.stringify({ items: [{ productId: testProdId, quantity: 1 }] }),
        note: 'Customer went to get wallet'
      })
    });
    const holdData = await holdRes.json();
    heldId = holdData.heldSaleId;

    const listHeldRes = await fetch(`${BASE_URL}/pos/held`, { headers: headersA });
    const listHeldData = await listHeldRes.json();
    const hasHeld = listHeldData.heldSales?.some(h => h.id === heldId);

    const delHeldRes = await fetch(`${BASE_URL}/pos/held/${heldId}`, { method: 'DELETE', headers: headersA });

    report(
      5,
      'Hold & Resume Sale Workflow',
      holdRes.status === 201 && hasHeld && delHeldRes.ok,
      `Cart held (ID: ${heldId}), listed in store held carts, and cleared cleanly upon resume.`
    );
  } catch (err) {
    report(5, 'Hold & Resume Sale Workflow', false, err.message);
  }

  // 6. Invoice & Printable Receipt Generation
  try {
    const receiptRes = await fetch(`${BASE_URL}/pos/receipt/${completedSaleId}`, { headers: headersA });
    const receiptData = await receiptRes.json();
    const r = receiptData.receipt;
    const isValidReceipt = r && r.sale && r.items.length > 0 && r.business && r.settings;

    report(
      6,
      'Invoice & Printable Receipt Generation',
      receiptRes.ok && isValidReceipt,
      `Generated complete receipt data for Invoice #${r?.sale?.invoice_number} (${r?.items?.length} items, Store: ${r?.business?.name})`
    );
  } catch (err) {
    report(6, 'Invoice & Printable Receipt Generation', false, err.message);
  }

  // 7. Sales History Ledger & Filtering
  try {
    const salesRes = await fetch(`${BASE_URL}/sales?search=${invoiceNumber}`, { headers: headersA });
    const salesData = await salesRes.json();
    const foundSale = salesData.sales?.some(s => s.invoice_number === invoiceNumber);

    report(
      7,
      'Sales History Ledger & Filtering',
      salesRes.ok && foundSale,
      `Searched sales ledger for Invoice #${invoiceNumber} -> Found 1 matching order record.`
    );
  } catch (err) {
    report(7, 'Sales History Ledger & Filtering', false, err.message);
  }

  // 8. Tenant Isolation (Business B attempting access to Business A Sale)
  try {
    const crossSaleRes = await fetch(`${BASE_URL}/pos/receipt/${completedSaleId}`, { headers: headersB });
    const crossSaleData = await crossSaleRes.json();

    report(
      8,
      'Multi-Tenant Isolation on Sales & Receipts',
      crossSaleRes.status === 404 && !crossSaleData.success,
      `Business B access to Invoice #${completedSaleId} rejected with Status ${crossSaleRes.status} ('${crossSaleData.message}')`
    );
  } catch (err) {
    report(8, 'Multi-Tenant Isolation on Sales & Receipts', false, err.message);
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passes} PASSED, ${fails} FAILED OUT OF 8 PROMPT 3 TESTS.`);
  console.log('================================================================');
}

runPrompt3Tests().catch(console.error);
