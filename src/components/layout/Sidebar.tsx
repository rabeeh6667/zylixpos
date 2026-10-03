import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { ZylixLogo } from '../common/ZylixLogo.tsx';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  Receipt,
  DollarSign,
  BarChart3,
  UserCheck,
  Activity as ActivityIcon,
  Settings,
  LogOut,
  Building2,
  ChevronRight
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, business, logout } = useAuth();
  const role = user?.role || 'CASHIER';

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
    { label: 'POS Billing', path: '/pos', icon: ShoppingCart, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
    { label: 'Sales History', path: '/sales', icon: Receipt, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
    { label: 'Products', path: '/products', icon: Package, roles: ['OWNER', 'MANAGER'] },
    { label: 'Inventory', path: '/inventory', icon: Boxes, roles: ['OWNER', 'MANAGER'] },
    { label: 'Customers', path: '/customers', icon: Users, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
    { label: 'Suppliers', path: '/suppliers', icon: Truck, roles: ['OWNER', 'MANAGER'] },
    { label: 'Expenses', path: '/expenses', icon: DollarSign, roles: ['OWNER', 'MANAGER'] },
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
    { label: 'Employees', path: '/users', icon: UserCheck, roles: ['OWNER', 'MANAGER'] },
    { label: 'Platform Tenants', path: '/platform/tenants', icon: Building2, roles: ['OWNER'], platformOwnerOnly: true },
    { label: 'Activity Log', path: '/activity', icon: ActivityIcon, roles: ['OWNER', 'MANAGER'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['OWNER'] },
  ];

  const filteredItems = navItems.filter((item) => {
    if (item.platformOwnerOnly && !user?.isPlatformOwner) {
      return false;
    }
    return item.roles.includes(role);
  });

  return (
    <aside className="app-sidebar">
      {/* Brand Logo Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <ZylixLogo size={42} />
      </div>

      {/* Main Navigation List */}
      <nav style={{ padding: '1rem 0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.6875rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                background: isActive ? 'var(--gradient-primary)' : 'transparent',
                boxShadow: isActive ? 'var(--shadow-gradient)' : 'none',
                transition: 'all 0.2s ease',
              })}
            >
              {({ isActive }) => (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Icon size={19} style={{ color: isActive ? '#FFFFFF' : 'var(--text-secondary)' }} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} style={{ color: '#FFFFFF', opacity: 0.8 }} />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Profile & Tenant Section */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {business?.name || 'Main Store'}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name} ({user?.role})
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost btn-sm"
            title="Sign Out"
            style={{ padding: '0.375rem', color: 'var(--color-danger)', flexShrink: 0 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
