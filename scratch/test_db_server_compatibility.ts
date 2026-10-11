import { isPg, initDb, query, execute } from '../server/src/db/dbAdapter.ts';
import { translateSqlToPg, sanitizePgErrorMessage } from '../server/src/db/pg.ts';
import { db as sqliteDb, initDatabase as initSqliteDb } from '../server/src/db/index.ts';
import { PGlite } from '@electric-sql/pglite';
import { setCustomPgPool, initPgDatabase } from '../server/src/db/pg.ts';

async function verifyCompatibility() {
  console.log('====================================================');
  console.log('🔍 Running Database & Server Compatibility Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // --- Step 2: Verify Startup & Adapter Mode Selection ---
  console.log('\n[Step 2.1] Verifying Adapter Mode Selection...');

  const originalEnvUrl = process.env.DATABASE_URL;

  // 1. Without DATABASE_URL -> SQLite fallback
  delete process.env.DATABASE_URL;
  assert(!isPg(), 'isPg() returns false when DATABASE_URL is unset');

  // 2. With DATABASE_URL -> PostgreSQL mode
  process.env.DATABASE_URL = 'postgresql://fake_user:fake_password@localhost:5432/fake_db';
  assert(isPg(), 'isPg() returns true when DATABASE_URL is set');

  // Restore env
  if (originalEnvUrl) {
    process.env.DATABASE_URL = originalEnvUrl;
  } else {
    delete process.env.DATABASE_URL;
  }

  // 3. Error Sanitization Check (Never leak secrets in logs)
  console.log('\n[Step 2.2] Verifying Credential Sanitization...');
  const secretUrl = 'postgresql://super_user:SuperSecretPassword123!@db.host.render.com:5432/zylix_prod';
  const sanitized = sanitizePgErrorMessage(new Error(`Connection failed to ${secretUrl}`));
  assert(!sanitized.includes('SuperSecretPassword123!'), 'Database password masked from log output');
  assert(sanitized.includes('****'), 'Password replaced with **** mask');

  // 4. Failure Prevention: Verify server does NOT start partially if DB fails
  console.log('\n[Step 2.3] Verifying Startup Failure Behavior...');
  const failingPool: any = {
    query: async () => {
      throw new Error('ECONNREFUSED connect to postgresql://user:pass@127.0.0.1:5432/db');
    },
  };
  let errorCaught = false;
  try {
    await initPgDatabase(failingPool);
  } catch (err: any) {
    errorCaught = true;
    assert(err.message.includes('PostgreSQL database connection failed'), 'initPgDatabase throws when connection fails');
  }
  assert(errorCaught, 'Initialization failure correctly stops execution');

  // --- Step 3: Verify Both Schemas & Schema Conventions ---
  console.log('\n[Step 3.1] Verifying SQLite Schema & Indexes...');
  initSqliteDb();
  
  // Inspect table info in SQLite
  const sqliteCols = sqliteDb.prepare("PRAGMA table_info('suppliers')").all() as any[];
  const sqliteColNames = sqliteCols.map(c => c.name);
  assert(sqliteColNames.includes('id'), 'SQLite suppliers has id');
  assert(sqliteColNames.includes('business_id'), 'SQLite suppliers has business_id');
  assert(sqliteColNames.includes('name'), 'SQLite suppliers has name');
  assert(sqliteColNames.includes('contact_person'), 'SQLite suppliers has contact_person');
  assert(sqliteColNames.includes('phone'), 'SQLite suppliers has phone');
  assert(sqliteColNames.includes('email'), 'SQLite suppliers has email');
  assert(sqliteColNames.includes('category'), 'SQLite suppliers has category');
  assert(sqliteColNames.includes('address'), 'SQLite suppliers has address');
  assert(sqliteColNames.includes('status'), 'SQLite suppliers has status');
  assert(sqliteColNames.includes('created_at'), 'SQLite suppliers has created_at');
  assert(sqliteColNames.includes('updated_at'), 'SQLite suppliers has updated_at');

  const sqliteIndexes = sqliteDb.prepare("PRAGMA index_list('suppliers')").all() as any[];
  const sqliteIndexNames = sqliteIndexes.map(i => i.name);
  assert(sqliteIndexNames.includes('idx_suppliers_business'), 'SQLite suppliers has idx_suppliers_business index');

  console.log('\n[Step 3.2] Verifying PostgreSQL Schema & Indexes via PGlite...');
  const pglite = new PGlite();
  const pgMockPool: any = {
    query: async (text: string, params: any[] = []) => {
      const res = await pglite.query(text, params);
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
    },
    connect: async () => ({
      query: async (text: string, params: any[] = []) => {
        const res = await pglite.query(text, params);
        return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
      },
      release: () => {},
    }),
  };

  await initPgDatabase(pgMockPool);

  const pgColsRes = await pgMockPool.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'suppliers'
  `);
  const pgCols = pgColsRes.rows;
  const pgColMap = new Map(pgCols.map((c: any) => [c.column_name, c]));

  assert(pgColMap.has('id'), 'PostgreSQL suppliers has id');
  assert(pgColMap.has('business_id'), 'PostgreSQL suppliers has business_id');
  assert(pgColMap.has('name'), 'PostgreSQL suppliers has name');
  assert(pgColMap.has('contact_person'), 'PostgreSQL suppliers has contact_person');
  assert(pgColMap.has('phone'), 'PostgreSQL suppliers has phone');
  assert(pgColMap.has('email'), 'PostgreSQL suppliers has email');
  assert(pgColMap.has('category'), 'PostgreSQL suppliers has category');
  assert(pgColMap.has('address'), 'PostgreSQL suppliers has address');
  assert(pgColMap.has('status'), 'PostgreSQL suppliers has status');
  assert(pgColMap.has('created_at'), 'PostgreSQL suppliers has created_at');
  assert(pgColMap.has('updated_at'), 'PostgreSQL suppliers has updated_at');

  // Verify business-scoped index in PostgreSQL
  const pgIndexRes = await pgMockPool.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'suppliers'
  `);
  const pgIndexes = pgIndexRes.rows.map((r: any) => r.indexname);
  assert(pgIndexes.includes('idx_suppliers_business'), 'PostgreSQL has idx_suppliers_business index');

  // Foreign Key verification in PostgreSQL
  const pgFkRes = await pgMockPool.query(`
    SELECT
      tc.constraint_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'suppliers';
  `);
  const fkBusinesses = pgFkRes.rows.find((r: any) => r.foreign_table_name === 'businesses');
  assert(Boolean(fkBusinesses), 'PostgreSQL suppliers table has foreign key constraint referencing businesses');

  // --- Step 3.3: SQL Translation & Dynamic Dialects ---
  console.log('\n[Step 3.3] Verifying Dynamic Dialect Translation...');
  const selectQuery = 'SELECT * FROM suppliers WHERE business_id = ? AND status = ?';
  assert(
    translateSqlToPg(selectQuery) === 'SELECT * FROM suppliers WHERE business_id = $1 AND status = $2',
    'translateSqlToPg transforms parameterized placeholders correctly'
  );

  const insertIgnoreQuery = 'INSERT OR IGNORE INTO suppliers (id, business_id) VALUES (?, ?)';
  const translatedInsert = translateSqlToPg(insertIgnoreQuery);
  assert(
    translatedInsert.includes('ON CONFLICT DO NOTHING') && !translatedInsert.includes('OR IGNORE'),
    'translateSqlToPg converts INSERT OR IGNORE to ON CONFLICT DO NOTHING'
  );

  console.log('\n====================================================');
  console.log(`📊 Compatibility Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyCompatibility().catch((err) => {
  console.error('Fatal compatibility verification error:', err);
  process.exit(1);
});
