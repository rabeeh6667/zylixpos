import React from 'react';
import { Navbar } from './Navbar.tsx';
import { Sidebar } from './Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Navigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../common/ErrorBoundary.tsx';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', color: '#64748B' }}>
        <div style={{ width: '42px', height: '42px', border: '3px solid #E2E8F0', borderTopColor: '#F43F7A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ marginTop: '1rem', fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>Checking authentication...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="app-body">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
