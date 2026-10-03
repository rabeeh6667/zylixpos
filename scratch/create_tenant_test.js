import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.resolve('server/data/zylix.db');
const db = new Database(dbPath);

async function seedTenantIsolationTest() {
  console.log('[Tenant Test Setup] Seeding Business A (ABC Bakery) and Business B (XYZ Store)...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  // 1. Business A: ABC Bakery
  const busAId = 'bus_abc_bakery';
  const ownerAId = 'user_owner_a';

  db.prepare(`
    INSERT OR REPLACE INTO businesses (id, name, business_type, email)
    VALUES (?, ?, ?, ?)
  `).run(busAId, 'ABC Bakery', 'Bakery', 'contact@abcbakery.com');

  db.prepare(`
    INSERT OR REPLACE INTO users (id, business_id, name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, 'OWNER', 'ACTIVE')
  `).run(ownerAId, busAId, 'Owner A (ABC Bakery)', 'owner-a@test.com', passwordHash);

  db.prepare(`
    INSERT OR REPLACE INTO products (id, business_id, name, sku, barcode, selling_price, current_stock, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run('prod_bakery_cake', busAId, 'Bakery Cake', 'CAKE-001', '111111111111', 25.00, 50);

  db.prepare(`
    INSERT OR REPLACE INTO customers (id, business_id, name, email)
    VALUES (?, ?, ?, ?)
  `).run('cust_a_customer', busAId, 'A Customer', 'customer-a@test.com');

  // 2. Business B: XYZ Store
  const busBId = 'bus_xyz_store';
  const ownerBId = 'user_owner_b';

  db.prepare(`
    INSERT OR REPLACE INTO businesses (id, name, business_type, email)
    VALUES (?, ?, ?, ?)
  `).run(busBId, 'XYZ Store', 'General Store', 'contact@xyzstore.com');

  db.prepare(`
    INSERT OR REPLACE INTO users (id, business_id, name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, 'OWNER', 'ACTIVE')
  `).run(ownerBId, busBId, 'Owner B (XYZ Store)', 'owner-b@test.com', passwordHash);

  db.prepare(`
    INSERT OR REPLACE INTO products (id, business_id, name, sku, barcode, selling_price, current_stock, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run('prod_store_product', busBId, 'Store Product', 'PROD-001', '222222222222', 49.99, 100);

  db.prepare(`
    INSERT OR REPLACE INTO customers (id, business_id, name, email)
    VALUES (?, ?, ?, ?)
  `).run('cust_b_customer', busBId, 'B Customer', 'customer-b@test.com');

  console.log('[Tenant Test Setup] Seed completed successfully.');
}

seedTenantIsolationTest().catch(console.error);
