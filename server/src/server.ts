import express from 'express';
import cors from 'cors';
import { config } from './config/index.ts';
import { initDb } from './db/dbAdapter.ts';
import { errorHandler } from './middleware/errorHandler.ts';

// Route imports
import authRoutes from './routes/auth.ts';
import userRoutes from './routes/users.ts';
import businessRoutes from './routes/business.ts';
import settingsRoutes from './routes/settings.ts';
import dashboardRoutes from './routes/dashboard.ts';
import auditRoutes from './routes/audit.ts';
import productRoutes from './routes/products.ts';
import categoryRoutes from './routes/categories.ts';
import inventoryRoutes from './routes/inventory.ts';
import customerRoutes from './routes/customers.ts';
import supplierRoutes from './routes/suppliers.ts';
import salesRoutes from './routes/sales.ts';
import posRoutes from './routes/pos.ts';
import expenseRoutes from './routes/expenses.ts';
import reportRoutes from './routes/reports.ts';
import { seedDatabase } from './db/seed.ts';
import notificationRoutes from './routes/notifications.ts';
import systemRoutes from './routes/system.ts';
import tenantRoutes from './routes/tenants.ts';

const app = express();

// Middleware
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://zylixpos.com',
  'https://www.zylixpos.com',
];

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.zylixpos.com') ||
        origin.includes('zylixpos.com')
      ) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

// Initialize Database & Tables
await initDb();

// Demo only: create sample accounts when SEED_DEMO_DATA=true
if (process.env.SEED_DEMO_DATA === 'true') {
  seedDatabase().catch((err) => console.error('[Seed Error]', err));
}

// One-time startup wipe: clear all test tenants on boot (set WIPE_TENANTS_ON_START=true in Render env)
if (process.env.WIPE_TENANTS_ON_START === 'true') {
  import('./db/dbAdapter.ts').then(async ({ transaction }) => {
    try {
      console.log('[WIPE] Starting tenant wipe on startup...');
      await transaction(async (tx) => {
        // Keep platform owner business; delete everything else
        const platformOwner = await tx.queryOne<any>(
          `SELECT business_id FROM users WHERE is_platform_owner = 1 LIMIT 1`
        );
        const ownerBizId = platformOwner?.business_id || '';
        const params = ownerBizId ? [ownerBizId] : [];
        const busWhere = ownerBizId ? 'WHERE id != ?' : '';
        const rowWhere = ownerBizId ? 'WHERE business_id != ?' : '';
        await tx.execute(`DELETE FROM sale_items ${rowWhere}`, params);
        await tx.execute(`DELETE FROM payments ${rowWhere}`, params);
        await tx.execute(`DELETE FROM sales ${rowWhere}`, params);
        await tx.execute(`DELETE FROM held_sales ${rowWhere}`, params);
        await tx.execute(`DELETE FROM inventory_transactions ${rowWhere}`, params);
        await tx.execute(`DELETE FROM products ${rowWhere}`, params);
        await tx.execute(`DELETE FROM categories ${rowWhere}`, params);
        await tx.execute(`DELETE FROM customers ${rowWhere}`, params);
        await tx.execute(`DELETE FROM suppliers ${rowWhere}`, params);
        await tx.execute(`DELETE FROM expenses ${rowWhere}`, params);
        await tx.execute(`DELETE FROM expense_categories ${rowWhere}`, params);
        await tx.execute(`DELETE FROM notifications ${rowWhere}`, params);
        await tx.execute(`DELETE FROM tenant_payments ${rowWhere}`, params);
        await tx.execute(`DELETE FROM settings ${rowWhere}`, params);
        await tx.execute(`DELETE FROM audit_logs ${rowWhere}`, params);
        await tx.execute(`DELETE FROM users WHERE is_platform_owner != 1 ${ownerBizId ? 'AND business_id != ?' : ''}`, ownerBizId ? [ownerBizId] : []);
        await tx.execute(`DELETE FROM businesses ${busWhere}`, params);
      });
      console.log('[WIPE] All test tenants wiped successfully. Platform owner preserved.');
    } catch (e: any) {
      console.error('[WIPE] Error during startup tenant wipe:', e.message);
    }
  }).catch((e: any) => console.error('[WIPE] Import error:', e.message));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    product: 'ZYLIX POS',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  🚀 ZYLIX POS Server running on http://localhost:${PORT}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`====================================================`);
});

export default app;
