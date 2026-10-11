import { PGlite } from '@electric-sql/pglite';
import { setCustomPgPool, initPgDatabase, translateSqlToPg } from '../server/src/db/pg.ts';
import { cryptoUUID } from '../server/src/utils/crypto.ts';

async function testPgSupplierPath() {
  console.log('====================================================');
  console.log('🐘 Testing PostgreSQL Path with PGlite (Local In-Memory)');
  console.log('====================================================');

  const pglite = new PGlite();
  
  // Create pool wrapper conforming to pg.Pool interface
  const mockPool: any = {
    query: async (text: string, params: any[] = []) => {
      const res = await pglite.query(text, params);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    connect: async () => ({
      query: async (text: string, params: any[] = []) => {
        const res = await pglite.query(text, params);
        return {
          rows: res.rows,
          rowCount: res.affectedRows ?? res.rows.length,
        };
      },
      release: () => {},
    }),
  };

  setCustomPgPool(mockPool);

  console.log('[PG Test] Initializing PostgreSQL schema (including suppliers table)...');
  await initPgDatabase(mockPool);
  console.log('  ✅ PostgreSQL Schema initialized successfully');

  // Verify suppliers table structure in PostgreSQL
  const tableCheck = await mockPool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'suppliers'
    ORDER BY ordinal_position
  `);
  console.log('  ✅ Table "suppliers" columns in PostgreSQL:');
  for (const col of tableCheck.rows) {
    console.log(`     - ${col.column_name} (${col.data_type})`);
  }

  // Test insert supplier into PostgreSQL
  const businessA = 'bus_pg_test_a';
  const businessB = 'bus_pg_test_b';
  await mockPool.query(
    'INSERT INTO businesses (id, name, business_type) VALUES ($1, $2, $3)',
    [businessA, 'PG Bakery A', 'Bakery']
  );
  await mockPool.query(
    'INSERT INTO businesses (id, name, business_type) VALUES ($1, $2, $3)',
    [businessB, 'PG Retail B', 'Retail']
  );

  const supplierAId = cryptoUUID();
  const insertSql = translateSqlToPg(`
    INSERT INTO suppliers (
      id, business_id, name, contact_person, phone, email, category, address, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await mockPool.query(insertSql, [
    supplierAId,
    businessA,
    'PG Dairy Wholesaler',
    'Vikram Mehta',
    '+91 9123456789',
    'orders@pgdairy.in',
    'Dairy & Beverages',
    '101 Industrial Estate',
    'ACTIVE',
  ]);
  console.log('  ✅ Insert supplier into PostgreSQL succeeded');

  // Test select
  const selectSql = translateSqlToPg('SELECT * FROM suppliers WHERE id = ? AND business_id = ?');
  const selectRes = await mockPool.query(selectSql, [supplierAId, businessA]);
  if (selectRes.rows.length === 1 && selectRes.rows[0].name === 'PG Dairy Wholesaler') {
    console.log('  ✅ SELECT supplier from PostgreSQL succeeded with tenant isolation');
  } else {
    throw new Error('Failed to retrieve supplier from PostgreSQL');
  }

  // Cross-tenant isolation test: Business B cannot query Business A's supplier
  const crossSelectRes = await mockPool.query(selectSql, [supplierAId, businessB]);
  if (crossSelectRes.rows.length === 0) {
    console.log('  ✅ Cross-tenant query in PostgreSQL correctly returned 0 rows');
  } else {
    throw new Error('PostgreSQL cross-tenant isolation failed');
  }

  // Test update
  const updateSql = translateSqlToPg(`
    UPDATE suppliers 
    SET phone = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND business_id = ?
  `);
  await mockPool.query(updateSql, ['+91 9999999999', supplierAId, businessA]);
  const verifyUpdate = await mockPool.query(selectSql, [supplierAId, businessA]);
  if (verifyUpdate.rows[0].phone === '+91 9999999999') {
    console.log('  ✅ UPDATE supplier in PostgreSQL succeeded');
  } else {
    throw new Error('PostgreSQL update verification failed');
  }

  // Test delete
  const deleteSql = translateSqlToPg('DELETE FROM suppliers WHERE id = ? AND business_id = ?');
  await mockPool.query(deleteSql, [supplierAId, businessA]);
  const verifyDelete = await mockPool.query(selectSql, [supplierAId, businessA]);
  if (verifyDelete.rows.length === 0) {
    console.log('  ✅ DELETE supplier in PostgreSQL succeeded');
  } else {
    throw new Error('PostgreSQL delete verification failed');
  }

  console.log('====================================================');
  console.log('🎉 PostgreSQL Schema & Query Tests Passed 100%');
  console.log('====================================================');
}

testPgSupplierPath().catch((err) => {
  console.error('Fatal PG test error:', err);
  process.exit(1);
});
