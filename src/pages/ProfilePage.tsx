import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { RoleBadge, StatusBadge } from '../components/ui/Badge.tsx';
import { User, Building2, Shield, Calendar, Mail, Key } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, business } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>
      
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>User Profile & Account</h1>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Overview of your active account identity, business tenant details, and security roles.
        </p>
      </div>

      <div className="zylix-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.75rem' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            color: '#fff',
            boxShadow: '0 8px 20px -4px rgba(59, 130, 246, 0.4)',
          }}
        >
          {user?.name.charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{user?.name}</h2>
            <RoleBadge role={user?.role || 'CASHIER'} />
            <StatusBadge status={user?.status || 'ACTIVE'} />
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Mail size={14} /> {user?.email}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        
        <div className="zylix-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={16} style={{ color: '#60a5fa' }} /> Associated Business Tenant
          </h3>
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#d1d5db' }}>
            <div><strong style={{ color: '#f9fafb' }}>Business Name:</strong> {business?.name}</div>
            <div><strong style={{ color: '#f9fafb' }}>Category:</strong> {business?.businessType}</div>
            <div><strong style={{ color: '#f9fafb' }}>Phone:</strong> {business?.phone || 'Not set'}</div>
            <div><strong style={{ color: '#f9fafb' }}>Address:</strong> {business?.address || 'Not set'}</div>
          </div>
        </div>

        <div className="zylix-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} style={{ color: '#10b981' }} /> System Permissions & Isolation
          </h3>
          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>• Enforced multi-tenant isolation for Tenant ID: <code style={{ color: '#60a5fa' }}>{business?.id}</code></div>
            <div>• Authenticated JWT Token session active</div>
            <div>• Role level access: <strong style={{ color: '#f3f4f6' }}>{user?.role}</strong></div>
          </div>
        </div>

      </div>

    </div>
  );
};
