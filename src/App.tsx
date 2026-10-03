import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { NetworkProvider } from './context/NetworkContext.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';

import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PosPage } from './pages/PosPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { InventoryPage } from './pages/InventoryPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { SalesPage } from './pages/SalesPage.tsx';
import { ExpensesPage } from './pages/ExpensesPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { ActivityPage } from './pages/ActivityPage.tsx';
import { TenantsPage } from './pages/TenantsPage.tsx';

import { SuppliersPage } from './pages/SectionPlaceholders.tsx';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <NetworkProvider>
          <AuthProvider>
            <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected App Routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/platform/tenants" element={<TenantsPage />} />
              <Route path="/platform/tenants/:businessId" element={<TenantsPage />} />
              <Route path="/tenants" element={<Navigate to="/platform/tenants" replace />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Default Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </NetworkProvider>
    </ToastProvider>
  </BrowserRouter>
);
};

export default App;
