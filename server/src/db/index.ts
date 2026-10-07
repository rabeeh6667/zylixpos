import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.ts';

// Ensure data directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  console.log(`[Database] Initializing SQLite database at: ${config.dbPath}`);

  const schema = `
    -- Businesses (Multi-tenant)
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_type TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      logo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Roles Reference
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('OWNER', 'MANAGER', 'CASHIER')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    -- Business Settings
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      UNIQUE(business_id, key)
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      UNIQUE(business_id, name)
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      category_id TEXT,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      brand TEXT,
      description TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      tax_percentage REAL DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit TEXT DEFAULT 'pcs',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Inventory Transactions Audit Trail
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'SALE', 'RETURN', 'ADJUSTMENT')),
      quantity INTEGER NOT NULL,
      reference_id TEXT,
      notes TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      total_spent REAL DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    -- Sales Master Table
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      customer_id TEXT,
      invoice_number TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'CASH',
      payment_status TEXT DEFAULT 'PAID' CHECK(payment_status IN ('PAID', 'PARTIAL', 'UNPAID')),
      status TEXT DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')),
      idempotency_key TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Sale Line Items
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    -- Payments Audit Table (Supports split payments)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CARD', 'UPI', 'SPLIT')),
      amount REAL NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    -- Held Sales (POS Cart Hold & Resume)
    CREATE TABLE IF NOT EXISTS held_sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      customer_id TEXT,
      cart_json TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Expense Categories
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      UNIQUE(business_id, name)
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT,
      category TEXT NOT NULL,
      category_id TEXT,
      amount REAL NOT NULL,
      description TEXT,
      payment_method TEXT DEFAULT 'CASH',
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Tenant Platform Revenue & Subscription Payments
    CREATE TABLE IF NOT EXISTS tenant_payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      payment_type TEXT NOT NULL CHECK(payment_type IN ('INITIAL_PAYMENT', 'MONTHLY_SUBSCRIPTION', 'OTHER')),
      amount REAL NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      payment_method TEXT DEFAULT 'UPI',
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );
  `;

  db.exec(schema);

  // Migration Column Guards: ALTER existing tables BEFORE creating indexes that reference new columns
  const ensureColumn = (table: string, column: string, colDef: string) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!cols.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef}`);
      }
    } catch (e) {
      // Column exists or table error
    }
  };

  ensureColumn('users', 'is_platform_owner', 'INTEGER DEFAULT 0');
  ensureColumn('businesses', 'status', "TEXT DEFAULT 'ACTIVE'");
  ensureColumn('businesses', 'city', 'TEXT');

  // Fix legacy users CHECK constraint to allow PENDING status
  try {
    const userTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any)?.sql || '';
    if (userTableSql.includes("CHECK(status IN ('ACTIVE', 'INACTIVE'))")) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE users_temp (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('OWNER', 'MANAGER', 'CASHIER')),
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_platform_owner INTEGER DEFAULT 0,
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );
        INSERT INTO users_temp (id, business_id, name, email, password_hash, role, status, created_at, updated_at, is_platform_owner)
          SELECT id, business_id, name, email, password_hash, role, status, created_at, updated_at, COALESCE(is_platform_owner, 0) FROM users;
        DROP TABLE users;
        ALTER TABLE users_temp RENAME TO users;
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (mErr) {
    console.warn('[DB Migration Warning]', mErr);
  }
  ensureColumn('businesses', 'description', 'TEXT');
  ensureColumn('products', 'brand', 'TEXT');
  ensureColumn('audit_logs', 'description', 'TEXT');
  ensureColumn('categories', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  ensureColumn('sales', 'idempotency_key', 'TEXT');
  ensureColumn('sales', 'payment_status', "TEXT DEFAULT 'PAID'");
  ensureColumn('sales', 'notes', 'TEXT');
  ensureColumn('customers', 'notes', 'TEXT');
  ensureColumn('customers', 'status', "TEXT DEFAULT 'ACTIVE'");
  ensureColumn('customers', 'updated_at', 'DATETIME');
  ensureColumn('expenses', 'title', 'TEXT');
  ensureColumn('expenses', 'category_id', 'TEXT');
  ensureColumn('expenses', 'payment_method', "TEXT DEFAULT 'CASH'");
  ensureColumn('expenses', 'expense_date', 'DATETIME');
  ensureColumn('expenses', 'status', "TEXT DEFAULT 'ACTIVE'");
  ensureColumn('expenses', 'updated_at', 'DATETIME');

  // Create Indexes AFTER schema and column migrations are applied
  const indexSchema = `
    CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_settings_business ON settings(business_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id);
    CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);
    CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(business_id, status);
    CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory_transactions(business_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_transactions(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(business_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_unique_invoice ON sales(business_id, invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(business_id, idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_business ON sale_items(business_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_held_sales_business ON held_sales(business_id);
    CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(business_id, status);
    CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(business_id, expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(business_id, status);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(business_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(business_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(business_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(business_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(business_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(business_id, created_at);
  `;
  db.exec(indexSchema);

  // Seed default roles if not present
  const seedRoles = db.prepare('INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)');
  seedRoles.run('role_owner', 'OWNER', 'Full administrative access to business tenant');
  seedRoles.run('role_manager', 'MANAGER', 'Access to products, inventory, customers, and reports');
  seedRoles.run('role_cashier', 'CASHIER', 'Access to POS billing and basic customer entry');

  // Safe Schema Migrations for Platform Tenants & Advanced Discount System
  const safeAddColumn = (table: string, columnDef: string) => {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
    } catch (e) {
      // Column already exists
    }
  };

  // User table fields
  safeAddColumn('users', 'is_platform_owner INTEGER DEFAULT 0');

  // Businesses table fields
  safeAddColumn('businesses', 'status TEXT DEFAULT "ACTIVE"');
  safeAddColumn('businesses', 'description TEXT');
  safeAddColumn('businesses', 'city TEXT');
  safeAddColumn('businesses', 'state TEXT');
  safeAddColumn('businesses', 'country TEXT');
  safeAddColumn('businesses', 'tax_number TEXT');
  safeAddColumn('businesses', 'currency TEXT DEFAULT "INR"');
  safeAddColumn('businesses', 'timezone TEXT DEFAULT "Asia/Kolkata"');

  // Sales & Sale Items Discount fields
  safeAddColumn('sales', 'discount_percent REAL DEFAULT 0');
  safeAddColumn('sales', 'bill_discount_amount REAL DEFAULT 0');
  safeAddColumn('sales', 'product_discounts_total REAL DEFAULT 0');

  safeAddColumn('sale_items', 'discount_percent REAL DEFAULT 0');
  safeAddColumn('sale_items', 'discount_amount REAL DEFAULT 0');

  // Enforce strictly one ZYLIX Platform Owner: owner@zylix.com
  try {
    db.exec(`
      UPDATE users SET is_platform_owner = 0 WHERE LOWER(TRIM(email)) <> 'owner@zylix.com';
      UPDATE users SET name = 'Rabeeh', is_platform_owner = 1 WHERE role = 'OWNER' AND LOWER(TRIM(email)) = 'owner@zylix.com';
    `);
  } catch (e) {
    console.warn('[DB Migration Warning] Platform owner enforcement failed:', e);
  }

  // Self-healing migration: Ensure active business users have ACTIVE status so approved tenants can log in
  try {
    db.prepare(`
      UPDATE users 
      SET status = 'ACTIVE' 
      WHERE status = 'PENDING' 
      AND business_id IN (SELECT id FROM businesses WHERE status = 'ACTIVE')
    `).run();
  } catch (e) {
    // Ignore migration error
  }

  console.log('[Database] Schema initialized successfully.');
}
