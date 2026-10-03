import express from 'express';
import cors from 'cors';
import { config } from './config/index.ts';
import { initDatabase } from './db/index.ts';
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
import salesRoutes from './routes/sales.ts';
import posRoutes from './routes/pos.ts';
import expenseRoutes from './routes/expenses.ts';
import reportRoutes from './routes/reports.ts';

import notificationRoutes from './routes/notifications.ts';
import systemRoutes from './routes/system.ts';
import tenantRoutes from './routes/tenants.ts';

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Initialize Database & Tables
initDatabase();

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
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  🚀 ZYLIX POS Server running on http://localhost:${PORT}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`====================================================`);
});

export default app;
