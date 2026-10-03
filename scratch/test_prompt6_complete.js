const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('===================================================');
  console.log('  ZYLIX POS — PROMPT 6 & PART 9 FULL VALIDATION');
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
    const suffix = Date.now().toString().slice(-5);

    // 1. Platform Owner Login
    const poLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@zylix.com', password: 'Password123!' })
    });
    const poData = await poLoginRes.json();
    assert(poData.success && poData.user?.isPlatformOwner === true, '1. Platform Owner Login (isPlatformOwner = true)');
    const poToken = poData.token;

    // 2. Platform Tenants API Access
    const tenantsListRes = await fetch(`${API_BASE}/tenants`, {
      headers: { Authorization: `Bearer ${poToken}` }
    });
    const tenantsList = await tenantsListRes.json();
    assert(tenantsList.success && Array.isArray(tenantsList.tenants) && tenantsList.summary !== undefined, '2. Platform Tenants API Access (Summary + Tenants list)');

    // 3. Unauthorized User Access Check (Normal Business Owner & Cashier)
    const busReg = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Normal Business ${suffix}`,
        businessType: 'Retail',
        ownerName: `Normal Owner ${suffix}`,
        email: `normal_owner_${suffix}@test.com`,
        password: 'Password123!'
      })
    }).then(r => r.json());
    const normalToken = busReg.token;

    const unauthTenantsRes = await fetch(`${API_BASE}/tenants`, {
      headers: { Authorization: `Bearer ${normalToken}` }
    });
    assert(unauthTenantsRes.status === 403, '3. Unauthorized User Cannot Access Tenant Management (HTTP 403)');

    // 4. Create New Tenant via Platform Owner
    const createTenantRes = await fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${poToken}` },
      body: JSON.stringify({
        businessName: `New Platform Tenant ${suffix}`,
        businessEmail: `tenant_${suffix}@business.com`,
        businessPhone: '+1 555 0199',
        address: '100 Innovation Way',
        city: 'Metropolis',
        state: 'NY',
        country: 'USA',
        taxNumber: 'TAX-998877',
        currency: 'USD',
        timezone: 'America/New_York',
        ownerName: `Tenant Owner ${suffix}`,
        ownerEmail: `towner_${suffix}@business.com`,
        ownerPhone: '+1 555 0188',
        password: 'Password123!',
        status: 'ACTIVE'
      })
    }).then(r => r.json());

    assert(createTenantRes.success && (createTenantRes.business?.id || createTenantRes.businessId), '4. Platform Owner Can Create Tenant', JSON.stringify(createTenantRes));
    const newBusId = createTenantRes.business?.id || createTenantRes.businessId;

    // 5. New Tenant Starts With Zero Transactional Data
    const newTenantDetails = await fetch(`${API_BASE}/tenants/${newBusId}`, {
      headers: { Authorization: `Bearer ${poToken}` }
    }).then(r => r.json());

    const stats = newTenantDetails.stats || newTenantDetails.metrics;
    const startsAtZero = stats && 
      stats.totalSales === 0 && 
      stats.totalOrders === 0 && 
      stats.totalCustomers === 0 && 
      stats.totalProducts === 0 && 
      stats.totalExpenses === 0;
    assert(startsAtZero, '5. New Tenant Starts With Zero Transactional Data', JSON.stringify(stats));

    // 6. Tenant Isolation Check (Tenant A cannot see Tenant B data)
    const tenantOwnerLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `towner_${suffix}@business.com`, password: 'Password123!' })
    }).then(r => r.json());
    const tenantOwnerToken = tenantOwnerLogin.token;

    // Create product in new tenant
    const prodRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantOwnerToken}` },
      body: JSON.stringify({
        name: `Tenant Product ${suffix}`,
        sku: `TP-${suffix}`,
        price: 100,
        costPrice: 50,
        stockQuantity: 50,
        minStockLevel: 5
      })
    }).then(r => r.json());
    const prodId = prodRes.product?.id;

    // Verify normal business owner cannot query product from new tenant
    const normalProds = await fetch(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${normalToken}` }
    }).then(r => r.json());
    const leakedProd = normalProds.products?.find(p => p.id === prodId);
    assert(!leakedProd, '6. Tenant Isolation (Tenant A cannot access Tenant B products)');

    // 7. Tenant Suspension
    const suspendRes = await fetch(`${API_BASE}/tenants/${newBusId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${poToken}` },
      body: JSON.stringify({ status: 'SUSPENDED' })
    }).then(r => r.json());
    assert(suspendRes.success && (suspendRes.status === 'SUSPENDED' || suspendRes.business?.status === 'SUSPENDED'), '7. Tenant Can Be Suspended', JSON.stringify(suspendRes));

    // 8. Suspended Tenant Cannot Log In / Use Application
    const suspendedLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `towner_${suffix}@business.com`, password: 'Password123!' })
    });
    const suspendedData = await suspendedLoginRes.json();
    assert(suspendedLoginRes.status === 403 && suspendedData.code === 'TENANT_SUSPENDED', '8. Suspended Tenant Cannot Log In (HTTP 403 TENANT_SUSPENDED)');

    // 9. Reactivate Tenant
    const reactivateRes = await fetch(`${API_BASE}/tenants/${newBusId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${poToken}` },
      body: JSON.stringify({ status: 'ACTIVE' })
    }).then(r => r.json());
    assert(reactivateRes.success && (reactivateRes.status === 'ACTIVE' || reactivateRes.business?.status === 'ACTIVE'), '9. Tenant Can Be Reactivated', JSON.stringify(reactivateRes));

    // Re-login after reactivation
    const reactivatedLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `towner_${suffix}@business.com`, password: 'Password123!' })
    }).then(r => r.json());
    const activeTenantToken = reactivatedLogin.token;

    // 10. Tenant Statistics Use Real DB Values
    const updatedTenantDetails = await fetch(`${API_BASE}/tenants/${newBusId}`, {
      headers: { Authorization: `Bearer ${poToken}` }
    }).then(r => r.json());
    const updatedStats = updatedTenantDetails.stats || updatedTenantDetails.metrics;
    assert(updatedStats?.totalProducts === 1, '10. Tenant Statistics Use Real DB Values (Product Count = 1)', JSON.stringify(updatedStats));

    // 11-19. Advanced Discount & POS Calculations
    // Product: Price 100, Cost 50, Stock 50, Qty 2
    // Product discount: 10% => ₹20 off => Item line net = ₹180
    // Bill discount: 10% => 10% of ₹180 = ₹18 off => Final subtotal before tax = ₹162
    // Tax rate (18% from default settings in newly created tenant):
    const settingsRes = await fetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${activeTenantToken}` }
    }).then(r => r.json());
    const taxRate = parseFloat(settingsRes.settings?.tax_rate || '18');
    const expectedTax = Math.round(162 * (taxRate / 100) * 100) / 100; // 29.16
    const expectedGrandTotal = Math.round((162 + expectedTax) * 100) / 100; // 191.16

    // POS Checkout with discounts
    const checkoutPayload = {
      items: [
        {
          id: prodId,
          quantity: 2,
          price: 100,
          discountPercent: 10,
          discountAmount: 20
        }
      ],
      grossSubtotal: 200,
      productDiscountsTotal: 20,
      netItemsSubtotal: 180,
      billDiscountPercent: 10,
      billDiscountAmount: 18,
      subtotal: 162,
      tax: expectedTax,
      grandTotal: expectedGrandTotal,
      paymentMethod: 'CASH',
      amountPaid: expectedGrandTotal + 10,
      changeAmount: 10
    };

    const checkoutRes = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeTenantToken}`,
        'x-idempotency-key': `idemp-${suffix}-1`
      },
      body: JSON.stringify(checkoutPayload)
    }).then(r => r.json());

    assert(checkoutRes.success && checkoutRes.sale?.id, '11-19. POS Checkout With Product & Bill Discounts Succeeded', JSON.stringify(checkoutRes));
    const saleId = checkoutRes.sale?.id;

    // Check sale breakdown in DB
    const saleDetail = await fetch(`${API_BASE}/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${activeTenantToken}` }
    }).then(r => r.json());

    assert(saleDetail.sale?.product_discounts_total === 20, '13-14. Product Discount Percentage & Amount Stored Correctly', JSON.stringify(saleDetail.sale));
    assert(saleDetail.sale?.bill_discount_amount === 18 && saleDetail.sale?.discount_percent === 10, '15-16. Bill Discount Percentage & Amount Stored Correctly', JSON.stringify(saleDetail.sale));
    assert(saleDetail.sale?.subtotal === 162, '17. Product + Bill Discounts Combine Correctly', JSON.stringify(saleDetail.sale));
    assert(saleDetail.sale?.tax === expectedTax, '18. Tax Calculation Remains Correct', JSON.stringify(saleDetail.sale));
    assert(saleDetail.sale?.grand_total === expectedGrandTotal, '19. Grand Total Calculated Correctly', JSON.stringify(saleDetail.sale));

    // 20. Backend Rejects Manipulated Totals
    const cheatedPayload = {
      ...checkoutPayload,
      grandTotal: 10.00 // Attempting to cheat payment
    };
    const cheatedRes = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeTenantToken}`,
        'x-idempotency-key': `idemp-${suffix}-cheat`
      },
      body: JSON.stringify(cheatedPayload)
    });
    assert(cheatedRes.status === 400, '20. Backend Rejects Manipulated Totals (HTTP 400 VALIDATION_ERROR)');

    // 21. Stock Deduction Verification
    const updatedProd = await fetch(`${API_BASE}/products/${prodId}`, {
      headers: { Authorization: `Bearer ${activeTenantToken}` }
    }).then(r => r.json());
    assert(updatedProd.product?.current_stock === 48 || updatedProd.product?.stockQuantity === 48, '21. Stock Deduction Correct (50 - 2 = 48)', JSON.stringify(updatedProd.product));

    // 22. Invoice Displays Discounts Correctly
    const saleItems = saleDetail.sale?.items || [];
    assert(saleItems[0]?.discount_percent === 10 && saleItems[0]?.discount_amount === 20, '22. Invoice / Sale Items Display Discounts Correctly', JSON.stringify(saleItems[0]));

    // 23. Sales History Displays Discounts Correctly
    const salesList = await fetch(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${activeTenantToken}` }
    }).then(r => r.json());
    const historicalSale = salesList.sales?.find(s => s.id === saleId);
    assert(historicalSale && historicalSale.product_discounts_total === 20 && historicalSale.bill_discount_amount === 18, '23. Sales History Displays Discounts Correctly', JSON.stringify(historicalSale));

    // 24. Existing POS Checkout Still Works
    // 25. Idempotency Check
    const replayCheckout = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeTenantToken}`,
        'x-idempotency-key': `idemp-${suffix}-1` // Replaying same key
      },
      body: JSON.stringify(checkoutPayload)
    }).then(r => r.json());
    assert(replayCheckout.success && replayCheckout.sale?.id === saleId, '24-25. Idempotency Prevents Duplicate Checkout', JSON.stringify(replayCheckout));

    // 26. Tenant Isolation Intact (Tenant A cannot see Tenant B sale)
    const normalSalesRes = await fetch(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${normalToken}` }
    }).then(r => r.json());
    const leakedSale = normalSalesRes.sales?.find(s => s.id === saleId);
    assert(!leakedSale, '26. Tenant Isolation Remains Intact for Sales');

    // 27. Audit Logs Intact (Platform actions logged)
    const auditLogsRes = await fetch(`${API_BASE}/audit-logs`, {
      headers: { Authorization: `Bearer ${poToken}` }
    }).then(r => r.json());
    const tenantCreatedAudit = auditLogsRes.logs?.find(l => l.action === 'TENANT_CREATED');
    const tenantSuspendedAudit = auditLogsRes.logs?.find(l => l.action === 'TENANT_SUSPENDED');
    const tenantActivatedAudit = auditLogsRes.logs?.find(l => l.action === 'TENANT_ACTIVATED');
    assert(tenantCreatedAudit && tenantSuspendedAudit && tenantActivatedAudit, '27. Audit Logs Created for Tenant Actions');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n===================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================');
  if (failed > 0) process.exit(1);
}

runTests();
