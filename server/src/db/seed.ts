import { db, initDatabase } from './index.ts';
import bcrypt from 'bcryptjs';
import { cryptoUUID } from '../utils/crypto.ts';

export async function seedDatabase() {
  initDatabase();

  console.log('[Seed] Seeding database with initial multi-tenant test data...');

  // Check if initial business already exists
  const existingBusiness = db.prepare('SELECT id FROM businesses WHERE email = ?').get('owner@zylix.com');
  if (existingBusiness) {
    console.log('[Seed] Test data already present. Skipping seed.');
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Password123!', salt);

  // Business 1: Apex Retail Store (Retail)
  const bus1Id = 'bus_apex_001';
  db.prepare(`
    INSERT INTO businesses (id, name, business_type, phone, email, address, logo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    bus1Id,
    'Apex Retail Store',
    'Retail Shop',
    '+1 (555) 019-2834',
    'contact@apexretail.com',
    '100 Main Street, Suite 4B, New York, NY 10001',
    'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=150&auto=format&fit=crop&q=80'
  );

  // Business 1 Users: Owner, Manager, Cashier
  const user1OwnerId = 'user_apex_owner';
  const user1ManagerId = 'user_apex_manager';
  const user1CashierId = 'user_apex_cashier';

  const insertUser = db.prepare(`
    INSERT INTO users (id, business_id, name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(user1OwnerId, bus1Id, 'Rabeeh', 'owner@zylix.com', defaultPasswordHash, 'OWNER', 'ACTIVE');
  insertUser.run(user1ManagerId, bus1Id, 'Sarah Connor (Manager)', 'manager@zylix.com', defaultPasswordHash, 'MANAGER', 'ACTIVE');
  insertUser.run(user1CashierId, bus1Id, 'John Doe (Cashier)', 'cashier@zylix.com', defaultPasswordHash, 'CASHIER', 'ACTIVE');

  // Business 1 Settings
  const insertSetting = db.prepare(`
    INSERT INTO settings (id, business_id, key, value)
    VALUES (?, ?, ?, ?)
  `);

  insertSetting.run(cryptoUUID(), bus1Id, 'currency', 'USD');
  insertSetting.run(cryptoUUID(), bus1Id, 'currency_symbol', '$');
  insertSetting.run(cryptoUUID(), bus1Id, 'tax_rate', '8.5');
  insertSetting.run(cryptoUUID(), bus1Id, 'receipt_header', 'Apex Retail Store - Thank you for shopping with us!');
  insertSetting.run(cryptoUUID(), bus1Id, 'receipt_footer', 'Returns allowed within 14 days with original receipt.');
  insertSetting.run(cryptoUUID(), bus1Id, 'low_stock_threshold', '5');
  insertSetting.run(cryptoUUID(), bus1Id, 'allow_negative_inventory', 'false');

  // Business 1 Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, business_id, user_id, action, entity, entity_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(cryptoUUID(), bus1Id, user1OwnerId, 'BUSINESS_REGISTERED', 'business', bus1Id, JSON.stringify({ name: 'Apex Retail Store' }));
  insertAudit.run(cryptoUUID(), bus1Id, user1OwnerId, 'USER_CREATED', 'user', user1ManagerId, JSON.stringify({ name: 'Sarah Connor', role: 'MANAGER' }));
  insertAudit.run(cryptoUUID(), bus1Id, user1OwnerId, 'USER_CREATED', 'user', user1CashierId, JSON.stringify({ name: 'John Doe', role: 'CASHIER' }));

  // Business 2: Metro Bakery (Bakery - to verify tenant isolation!)
  const bus2Id = 'bus_metro_002';
  db.prepare(`
    INSERT INTO businesses (id, name, business_type, phone, email, address, logo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    bus2Id,
    'Metro Bakery & Café',
    'Bakery',
    '+1 (555) 987-6543',
    'orders@metrobakery.com',
    '45 Baker Avenue, San Francisco, CA 94102',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&auto=format&fit=crop&q=80'
  );

  const user2OwnerId = 'user_metro_owner';
  insertUser.run(user2OwnerId, bus2Id, 'Elena Rostova (Metro Owner)', 'metro@zylix.com', defaultPasswordHash, 'OWNER', 'ACTIVE');

  insertSetting.run(cryptoUUID(), bus2Id, 'currency', 'USD');
  insertSetting.run(cryptoUUID(), bus2Id, 'currency_symbol', '$');
  insertSetting.run(cryptoUUID(), bus2Id, 'tax_rate', '9.0');
  insertSetting.run(cryptoUUID(), bus2Id, 'receipt_header', 'Metro Bakery — Fresh Baked Goods Daily');
  insertSetting.run(cryptoUUID(), bus2Id, 'low_stock_threshold', '10');

  insertAudit.run(cryptoUUID(), bus2Id, user2OwnerId, 'BUSINESS_REGISTERED', 'business', bus2Id, JSON.stringify({ name: 'Metro Bakery & Café' }));

  console.log('[Seed] Database seeding completed successfully.');
  console.log('[Seed] Available Test Accounts (All password: Password123!):');
  console.log('  1. OWNER   : owner@zylix.com (Apex Retail Store)');
  console.log('  2. MANAGER : manager@zylix.com (Apex Retail Store)');
  console.log('  3. CASHIER : cashier@zylix.com (Apex Retail Store)');
  console.log('  4. OWNER 2 : metro@zylix.com (Metro Bakery - Multi-tenant test)');
}

// Run if called directly
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().catch((err) => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}
