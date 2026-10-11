import pg from 'pg';

const { Pool, types } = pg;

// Parse PostgreSQL NUMERIC/DECIMAL (OID 1700) and INT8/BIGINT (OID 20) as floats/numbers to match SQLite behavior
types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));
types.setTypeParser(20, (val: string) => (val === null ? null : parseInt(val, 10)));

export let pgPool: pg.Pool | null = null;

/**
 * Sanitizes error messages by masking database passwords and connection strings
 * to prevent leaking sensitive credentials in server logs.
 */
export function sanitizePgErrorMessage(error: any): string {
  if (!error) return 'Unknown database error';
  let message = typeof error === 'string' ? error : error.message || String(error);

  // Mask passwords in postgresql:// user:password@host:port/dbname URLs
  message = message.replace(/postgres(ql)?:\/\/([^:]+):([^@]+)@/gi, 'postgresql://$2:****@');
  // Mask password parameter strings (password=secret)
  message = message.replace(/password\s*=\s*['"]?[^'\s;&]+['"]?/gi, 'password=****');

  return message;
}

export function setCustomPgPool(custom: pg.Pool | any): void {
  pgPool = custom;
}

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required to initialize PostgreSQL connection.');
    }

    const useSsl =
      process.env.PG_SSL === 'true' ||
      process.env.NODE_ENV === 'production' ||
      databaseUrl.includes('render.com') ||
      databaseUrl.includes('supabase') ||
      databaseUrl.includes('neon') ||
      databaseUrl.includes('sslmode=require');

    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', sanitizePgErrorMessage(err));
    });
  }
  return pgPool;
}

export async function closePgPool(): Promise<void> {
  if (pgPool) {
    try {
      await pgPool.end();
    } catch (e) {
      // Ignore pool closing error
    } finally {
      pgPool = null;
    }
    console.log('[PostgreSQL] Connection pool closed gracefully.');
  }
}

/**
 * Translates standard SQLite/SQL queries to PostgreSQL compatible syntax.
 * Converts '?' parameters to PostgreSQL '$1', '$2', ...
 * Translates SQLite date functions to PostgreSQL date expressions.
 */
export function translateSqlToPg(sql: string): string {
  let translated = sql;

  // Replace SQLite date(x, "localtime") or date(x, 'localtime') -> (x)::date
  translated = translated.replace(/date\(\s*([^,\)]+)\s*,\s*["']localtime["']\s*\)/gi, '($1)::date');

  // Replace SQLite date(x) -> (x)::date
  translated = translated.replace(/date\(\s*([^,\)]+)\s*\)/gi, '($1)::date');

  // Parameter substitution: Replace ? with $1, $2, ...
  // Only replace ? outside of existing $1, $2
  let paramIndex = 1;
  translated = translated.replace(/\?/g, () => `$${paramIndex++}`);

  // Replace INSERT OR IGNORE INTO -> INSERT INTO ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = translated + ' ON CONFLICT DO NOTHING';
    }
  }

  // Replace INSERT OR REPLACE INTO settings (id, business_id, key, value) -> ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i, 'INSERT INTO settings');
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = translated + ' ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP';
    }
  }

  return translated;
}

export async function initPgDatabase(customPool?: pg.Pool): Promise<void> {
  const pool = customPool || getPgPool();
  console.log('[PostgreSQL] Validating database connection...');

  // 1. Mandatory connection ping check (SELECT 1)
  try {
    await pool.query('SELECT 1');
    console.log('[PostgreSQL] Connection check successful.');
  } catch (connErr: any) {
    const safeError = sanitizePgErrorMessage(connErr);
    console.error(`[PostgreSQL Fatal] Connection check failed: ${safeError}`);

    if (!customPool && pgPool) {
      await closePgPool().catch(() => {});
    }

    throw new Error(`PostgreSQL database connection failed: ${safeError}`);
  }

  console.log('[PostgreSQL] Initializing database schema...');

  const schema = `
    CREATE TABLE IF NOT EXISTS businesses (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      business_type VARCHAR(255) NOT NULL,
      phone VARCHAR(255),
      email VARCHAR(255),
      address TEXT,
      logo TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      city VARCHAR(255),
      state VARCHAR(255),
      country VARCHAR(255),
      tax_number VARCHAR(255),
      currency VARCHAR(50) DEFAULT 'INR',
      timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK(role IN ('OWNER', 'MANAGER', 'CASHIER')),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      is_platform_owner INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      key VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_business_setting UNIQUE (business_id, key)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      entity VARCHAR(255) NOT NULL,
      entity_id VARCHAR(255),
      metadata TEXT,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_business_category UNIQUE (business_id, name)
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      category_id VARCHAR(255) REFERENCES categories(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(255),
      barcode VARCHAR(255),
      brand VARCHAR(255),
      description TEXT,
      purchase_price NUMERIC DEFAULT 0,
      selling_price NUMERIC DEFAULT 0,
      tax_percentage NUMERIC DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit VARCHAR(50) DEFAULT 'pcs',
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      transaction_type VARCHAR(50) NOT NULL,
      quantity INTEGER NOT NULL,
      reference_id VARCHAR(255),
      notes TEXT,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(255),
      address TEXT,
      notes TEXT,
      total_spent NUMERIC DEFAULT 0,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      customer_id VARCHAR(255) REFERENCES customers(id) ON DELETE SET NULL,
      invoice_number VARCHAR(255) NOT NULL,
      subtotal NUMERIC DEFAULT 0,
      discount NUMERIC DEFAULT 0,
      tax NUMERIC DEFAULT 0,
      grand_total NUMERIC DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'CASH',
      payment_status VARCHAR(50) DEFAULT 'PAID',
      status VARCHAR(50) DEFAULT 'COMPLETED',
      idempotency_key VARCHAR(255),
      notes TEXT,
      discount_percent NUMERIC DEFAULT 0,
      bill_discount_amount NUMERIC DEFAULT 0,
      product_discounts_total NUMERIC DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      sale_id VARCHAR(255) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC NOT NULL,
      discount NUMERIC DEFAULT 0,
      tax NUMERIC DEFAULT 0,
      subtotal NUMERIC NOT NULL,
      discount_percent NUMERIC DEFAULT 0,
      discount_amount NUMERIC DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      sale_id VARCHAR(255) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      payment_method VARCHAR(50) NOT NULL,
      amount NUMERIC NOT NULL,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS held_sales (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      customer_id VARCHAR(255) REFERENCES customers(id) ON DELETE SET NULL,
      cart_json TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_business_expense_category UNIQUE (business_id, name)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255),
      category VARCHAR(255) NOT NULL,
      category_id VARCHAR(255) REFERENCES expense_categories(id) ON DELETE SET NULL,
      amount NUMERIC NOT NULL,
      description TEXT,
      payment_method VARCHAR(50) DEFAULT 'CASH',
      expense_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      entity_type VARCHAR(255),
      entity_id VARCHAR(255),
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_payments (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      payment_type VARCHAR(50) NOT NULL,
      amount NUMERIC NOT NULL,
      payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      payment_method VARCHAR(50) DEFAULT 'UPI',
      notes TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(255) PRIMARY KEY,
      business_id VARCHAR(255) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      phone VARCHAR(255),
      email VARCHAR(255),
      category VARCHAR(255),
      address TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
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
    CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);
  `;

  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }

  // Seed default roles if not present
  await pool.query(`
    INSERT INTO roles (id, name, description) VALUES
      ('role_owner', 'OWNER', 'Full administrative access to business tenant'),
      ('role_manager', 'MANAGER', 'Access to products, inventory, customers, and reports'),
      ('role_cashier', 'CASHIER', 'Access to POS billing and basic customer entry')
    ON CONFLICT (name) DO NOTHING;
  `);


  console.log('[PostgreSQL] Database schema initialized successfully.');
}
