import Database from 'better-sqlite3';

async function runExtraPrompt3Tests() {
  console.log('================================================================');
  console.log('   ZYLIX POS — EXTRA BACKEND VERIFICATION SUITE');
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

  // 0. Authenticate Business A & Business B
  const loginARes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-a@test.com', password: 'Password123!' })
  });
  const tokenA = (await loginARes.json()).token;
  const headersA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` };

  const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner-b@test.com', password: 'Password123!' })
  });
  const tokenB = (await loginBRes.json()).token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };

  // Setup Test Product with 50 units @ ₹1,000
  const prodBarcode = `SPLIT${Date.now()}`;
  const prodRes = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'High-Value Item',
      sellingPrice: 1000.00,
      currentStock: 50,
      barcode: prodBarcode
    })
  });
  const prodId = (await prodRes.json()).productId;

  // ----------------------------------------------------------------
  // 1. Split Payment Validation
  // ----------------------------------------------------------------
  let stock1 = 50;
  let pass1A = false, pass1B = false, pass1C = false;

  // 1A. Exact Split (₹600 Cash + ₹400 Card = ₹1,000) -> MUST PASS
  try {
    const res1A = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'SPLIT',
        payments: [
          { paymentMethod: 'CASH', amount: 600.00 },
          { paymentMethod: 'CARD', amount: 400.00 }
        ]
      })
    });
    const data1A = await res1A.json();

    const prodCheck = await fetch(`${BASE_URL}/products/${prodId}`, { headers: headersA });
    stock1 = (await prodCheck.json()).product.current_stock;

    pass1A = res1A.status === 201 && stock1 === 49;
  } catch (err) {
    pass1A = false;
  }

  // 1B. Underpaid Split (₹500 Cash + ₹400 Card = ₹900 vs ₹1,000 Total) -> MUST BE REJECTED
  try {
    const res1B = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'SPLIT',
        payments: [
          { paymentMethod: 'CASH', amount: 500.00 },
          { paymentMethod: 'CARD', amount: 400.00 }
        ]
      })
    });

    const prodCheck = await fetch(`${BASE_URL}/products/${prodId}`, { headers: headersA });
    const stockAfter1B = (await prodCheck.json()).product.current_stock;

    pass1B = res1B.status === 400 && stockAfter1B === stock1; // Inventory unchanged!
  } catch (err) {
    pass1B = false;
  }

  // 1C. Overpaid Split (₹600 Cash + ₹500 Card = ₹1,100 vs ₹1,000 Total) -> MUST BE REJECTED
  try {
    const res1C = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'SPLIT',
        payments: [
          { paymentMethod: 'CASH', amount: 600.00 },
          { paymentMethod: 'CARD', amount: 500.00 }
        ]
      })
    });

    const prodCheck = await fetch(`${BASE_URL}/products/${prodId}`, { headers: headersA });
    const stockAfter1C = (await prodCheck.json()).product.current_stock;

    pass1C = res1C.status === 400 && stockAfter1C === stock1; // Inventory unchanged!
  } catch (err) {
    pass1C = false;
  }

  report(
    1,
    'Split Payment Validation',
    pass1A && pass1B && pass1C,
    `Exact ₹1,000 split passed (Stock 50 -> 49). ₹900 & ₹1,100 split rejected (Status 400). Inventory remained protected at 49.`
  );

  // ----------------------------------------------------------------
  // 2. Concurrent Checkout
  // ----------------------------------------------------------------
  try {
    const p1 = fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'CASH'
      })
    });

    const p2 = fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'CASH'
      })
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    const d1 = await r1.json();
    const d2 = await r2.json();

    const inv1 = d1.sale?.invoiceNumber || d1.sale?.invoice_number;
    const inv2 = d2.sale?.invoiceNumber || d2.sale?.invoice_number;

    const prodCheck = await fetch(`${BASE_URL}/products/${prodId}`, { headers: headersA });
    const stockAfterConc = (await prodCheck.json()).product.current_stock;

    const distinctInvoices = inv1 && inv2 && inv1 !== inv2;
    const stockDeductedCorrectly = stockAfterConc === stock1 - 2;

    report(
      2,
      'Concurrent Checkout Safety',
      r1.ok && r2.ok && distinctInvoices && stockDeductedCorrectly,
      `Parallel checkouts completed successfully without collisions: Invoice 1 (${inv1}), Invoice 2 (${inv2}). Inventory reduced cleanly from ${stock1} to ${stockAfterConc}.`
    );
  } catch (err) {
    report(2, 'Concurrent Checkout Safety', false, err.message);
  }

  // ----------------------------------------------------------------
  // 3. Invoice Number Uniqueness Mechanism
  // ----------------------------------------------------------------
  try {
    const db = new Database('server/data/zylix.db');
    let duplicateRejected = false;

    // Fetch tenant ID for owner A
    const businessId = db.prepare(`SELECT business_id FROM users WHERE email = 'owner-a@test.com'`).get().business_id;

    try {
      db.prepare(`
        INSERT INTO sales (id, business_id, invoice_number, grand_total)
        VALUES ('dup-test-1', ?, 'INV-TEST-UNIQUE', 100)
      `).run(businessId);

      // Attempt duplicate insert of same invoice number under same business!
      db.prepare(`
        INSERT INTO sales (id, business_id, invoice_number, grand_total)
        VALUES ('dup-test-2', ?, 'INV-TEST-UNIQUE', 100)
      `).run(businessId);
    } catch (dbErr) {
      if (dbErr.message.includes('UNIQUE constraint failed')) {
        duplicateRejected = true;
      }
    } finally {
      // Clean up test rows
      db.prepare(`DELETE FROM sales WHERE invoice_number = 'INV-TEST-UNIQUE'`).run();
    }

    report(
      3,
      'Invoice Number Uniqueness Mechanism',
      duplicateRejected,
      `Database UNIQUE index (idx_sales_unique_invoice) strictly prevents duplicate invoice numbers per business ('UNIQUE constraint failed: sales.business_id, sales.invoice_number').`
    );
  } catch (err) {
    report(3, 'Invoice Number Uniqueness Mechanism', false, err.message);
  }

  // ----------------------------------------------------------------
  // 4. Payment Integrity
  // ----------------------------------------------------------------
  try {
    const singlePayRes = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'UPI'
      })
    });
    const singleSaleId = (await singlePayRes.json()).sale.id;

    const receiptRes = await fetch(`${BASE_URL}/pos/receipt/${singleSaleId}`, { headers: headersA });
    const receiptData = await receiptRes.json();
    const paymentsList = receiptData.receipt.payments;
    const saleObj = receiptData.receipt.sale;

    const totalRecordedPayment = paymentsList.reduce((acc, p) => acc + p.amount, 0);
    const matchesSaleTotal = totalRecordedPayment === saleObj.grand_total;

    report(
      4,
      'Payment Integrity',
      receiptRes.ok && matchesSaleTotal && paymentsList.length === 1 && paymentsList[0].payment_method === 'UPI',
      `Recorded payment amount (₹${totalRecordedPayment}) matches exact completed sale total (₹${saleObj.grand_total}). Payment audit trail verified.`
    );
  } catch (err) {
    report(4, 'Payment Integrity', false, err.message);
  }

  // ----------------------------------------------------------------
  // 5. Tenant Isolation on Receipts
  // ----------------------------------------------------------------
  try {
    // 5A. Sale created by Business A
    const saleA = await fetch(`${BASE_URL}/pos/checkout`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        items: [{ productId: prodId, quantity: 1, unitPrice: 1000.00 }],
        subtotal: 1000.00,
        grandTotal: 1000.00,
        paymentMethod: 'CASH'
      })
    });
    const saleAData = await saleA.json();
    const saleAId = saleAData.sale.id;
    const saleAInvoice = saleAData.sale.invoiceNumber || saleAData.sale.invoice_number;

    // 5B. Business B attempting access via Sale ID
    const getByIdRes = await fetch(`${BASE_URL}/pos/receipt/${saleAId}`, { headers: headersB });

    // 5C. Business B attempting access via Invoice Number
    const getByInvRes = await fetch(`${BASE_URL}/pos/receipt/${saleAInvoice}`, { headers: headersB });

    report(
      5,
      'Tenant Isolation on Receipts',
      getByIdRes.status === 404 && getByInvRes.status === 404,
      `Business B access attempts for Business A's receipt (by ID: ${saleAId}, by Invoice: ${saleAInvoice}) were rejected with Status 404 ('Sale invoice record not found').`
    );
  } catch (err) {
    report(5, 'Tenant Isolation on Receipts', false, err.message);
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passes} PASSED, ${fails} FAILED OUT OF 5 EXTRA TESTS.`);
  console.log('================================================================');
}

runExtraPrompt3Tests().catch(console.error);
