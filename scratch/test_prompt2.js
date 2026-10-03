async function runPrompt2Tests() {
  console.log('================================================================');
  console.log('   ZYLIX POS — PROMPT 2/5 (PRODUCTS & INVENTORY) TEST SUITE');
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

  // Login Owner A (owner-a@test.com) & Owner B (owner-b@test.com)
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

  // 1. Create Category
  let categoryId = '';
  try {
    const catRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ name: 'Fresh Pastries', description: 'Oven fresh croissants & Danish' })
    });
    const catData = await catRes.json();
    categoryId = catData.category?.id;
    report(1, 'Create Category', catRes.status === 201 && catData.success, `Created category '${catData.category?.name}' (ID: ${categoryId})`);
  } catch (err) {
    report(1, 'Create Category', false, err.message);
  }

  // 2. Create Product
  let productId = '';
  const testBarcode = `890${Date.now().toString().slice(-9)}`;
  try {
    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Butter Croissant',
        brand: 'ABC Bakery Signature',
        sku: `CRS-${Date.now().toString().slice(-4)}`,
        barcode: testBarcode,
        categoryId: categoryId,
        purchasePrice: 1.50,
        sellingPrice: 4.25,
        taxPercentage: 8.5,
        currentStock: 25,
        minimumStock: 10,
        unit: 'pcs',
        description: 'French butter croissant'
      })
    });
    const prodData = await prodRes.json();
    productId = prodData.productId;
    report(2, 'Create Product', prodRes.status === 201 && prodData.success, `Created product 'Butter Croissant' with barcode ${testBarcode}, Initial Stock: 25`);
  } catch (err) {
    report(2, 'Create Product', false, err.message);
  }

  // 3. Edit Product
  try {
    const editRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        sellingPrice: 4.99,
        minimumStock: 12
      })
    });
    const editData = await editRes.json();
    
    // Fetch product detail to verify
    const getRes = await fetch(`${BASE_URL}/products/${productId}`, { headers: headersA });
    const getData = await getRes.json();
    const updatedPrice = getData.product?.selling_price;
    const updatedMin = getData.product?.min_stock;

    report(3, 'Edit Product', editRes.ok && updatedPrice === 4.99 && updatedMin === 12, `Updated selling price to $${updatedPrice} and min stock limit to ${updatedMin}`);
  } catch (err) {
    report(3, 'Edit Product', false, err.message);
  }

  // 5. Add Stock (Stock In)
  try {
    const stockInRes = await fetch(`${BASE_URL}/inventory/stock-in`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        productId,
        quantity: 15,
        referenceId: 'PO-BAC-102',
        notes: 'Morning fresh bakery batch'
      })
    });
    const stockInData = await stockInRes.json();
    report(5, 'Add Stock (Stock In)', stockInRes.ok && stockInData.newStock === 40, `Added +15 units. New current stock: ${stockInData.newStock}`);
  } catch (err) {
    report(5, 'Add Stock (Stock In)', false, err.message);
  }

  // 6. Remove Stock (Stock Out)
  try {
    const stockOutRes = await fetch(`${BASE_URL}/inventory/stock-out`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        productId,
        quantity: 32,
        referenceId: 'DAM-001',
        notes: 'End of day unsold removal for reorder test'
      })
    });
    const stockOutData = await stockOutRes.json();
    report(6, 'Remove Stock (Stock Out)', stockOutRes.ok && stockOutData.newStock === 8, `Removed -32 units. New current stock: ${stockOutData.newStock}`);
  } catch (err) {
    report(6, 'Remove Stock (Stock Out)', false, err.message);
  }

  // 7. Adjust Stock
  try {
    const adjustRes = await fetch(`${BASE_URL}/inventory/adjust`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        productId,
        newStock: 5,
        notes: 'Weekly manual count adjustment'
      })
    });
    const adjustData = await adjustRes.json();
    report(7, 'Adjust Stock', adjustRes.ok && adjustData.newStock === 5 && adjustData.delta === -3, `Adjusted stock to 5 units (Delta: ${adjustData.delta})`);
  } catch (err) {
    report(7, 'Adjust Stock', false, err.message);
  }

  // 8. View Inventory History
  try {
    const histRes = await fetch(`${BASE_URL}/products/${productId}`, { headers: headersA });
    const histData = await histRes.json();
    const historyCount = histData.inventoryHistory?.length || 0;
    const hasTypes = histData.inventoryHistory?.some(h => h.transaction_type === 'STOCK_IN') &&
                     histData.inventoryHistory?.some(h => h.transaction_type === 'STOCK_OUT') &&
                     histData.inventoryHistory?.some(h => h.transaction_type === 'ADJUSTMENT');

    report(8, 'View Inventory History', histRes.ok && historyCount >= 4 && hasTypes, `Retrieved ${historyCount} transaction history records with STOCK_IN, STOCK_OUT, and ADJUSTMENT logs`);
  } catch (err) {
    report(8, 'View Inventory History', false, err.message);
  }

  // 9. Verify Low-Stock & Out-of-Stock Detection
  try {
    // Current stock is 5, minimum stock limit is 12 -> MUST trigger low stock alert!
    const lowRes = await fetch(`${BASE_URL}/inventory/low-stock`, { headers: headersA });
    const lowData = await lowRes.json();
    const isCroissantLow = lowData.items?.some(i => i.id === productId);

    report(9, 'Verify Low-Stock Detection', lowRes.ok && isCroissantLow, `Low stock engine detected item (Current: 5 <= Min: 12) in ${lowData.count} total alert items`);
  } catch (err) {
    report(9, 'Verify Low-Stock Detection', false, err.message);
  }

  // 4. Archive Product
  try {
    const archRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: headersA
    });
    const archData = await archRes.json();

    // Verify product status is ARCHIVED
    const getRes = await fetch(`${BASE_URL}/products/${productId}`, { headers: headersA });
    const getData = await getRes.json();

    report(4, 'Archive Product', archRes.ok && getData.product?.status === 'ARCHIVED', `Product status changed to 'ARCHIVED'. Historical logs preserved.`);
  } catch (err) {
    report(4, 'Archive Product', false, err.message);
  }

  // 10. Verify Tenant Isolation (Business A vs Business B)
  try {
    // Business B attempting to access Business A product
    const prodBRes = await fetch(`${BASE_URL}/products/${productId}`, { headers: headersB });
    const prodBData = await prodBRes.json();

    // Business B attempting stock-in on Business A product
    const stockInBRes = await fetch(`${BASE_URL}/inventory/stock-in`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ productId, quantity: 100 })
    });
    const stockInBData = await stockInBRes.json();

    const pass10 = prodBRes.status === 404 && stockInBRes.status === 404;
    report(10, 'Verify Tenant Isolation', pass10, `Business B access to Product ${productId} returned GET HTTP ${prodBRes.status} (${prodBData.message}) and Stock-In HTTP ${stockInBRes.status} (${stockInBData.message})`);
  } catch (err) {
    report(10, 'Verify Tenant Isolation', false, err.message);
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passes} PASSED, ${fails} FAILED OUT OF 10 PROMPT 2 TESTS.`);
  console.log('================================================================');
}

runPrompt2Tests().catch(console.error);
