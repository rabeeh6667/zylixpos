import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNetwork } from '../../context/NetworkContext.tsx';
import { apiFetch } from '../../services/api.ts';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  ShoppingCart,
  Bell,
  Package,
  DollarSign,
  Receipt,
  Users,
  AlertCircle,
  CheckCheck,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Menu
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
  entity_type?: string;
}

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { user, business, logout } = useAuth();
  const { networkStatus } = useNetwork();
  const navigate = useNavigate();

  const renderNetworkBadge = () => {
    switch (networkStatus) {
      case 'online':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
            title="Connected to ZYLIX POS Server"
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
            <span>Online</span>
          </div>
        );
      case 'offline':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'rgba(255, 122, 89, 0.12)',
              color: 'var(--color-coral)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
            title="No local internet connection"
          >
            <WifiOff size={13} />
            <span>Offline</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#D97706',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
            title="Reconnecting to server..."
          >
            <RefreshCw size={13} className="spin" />
            <span>Reconnecting</span>
          </div>
        );
      case 'server_unavailable':
      default:
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--color-danger)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
            title="ZYLIX POS Server unavailable"
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
            <span>Server unavailable</span>
          </div>
        );
    }
  };
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch('/api/notifications/unread-count');
      if (res.success) {
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (e) {
      // Silent error
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await apiFetch('/api/notifications?limit=20');
      if (res.success) {
        setNotifications(res.notifications || []);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleNotifications = () => {
    if (!showNotifications) {
      fetchNotifications();
    }
    setShowNotifications(!showNotifications);
    setShowDropdown(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      try {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: 1 } : item)));
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }

    setShowNotifications(false);

    // Contextual route navigation
    if (n.type === 'LOW_STOCK' || n.type === 'OUT_OF_STOCK' || n.entity_type === 'product') {
      navigate('/inventory');
    } else if (n.type === 'EXPENSE_RECORDED' || n.entity_type === 'expense') {
      navigate('/expenses');
    } else if (n.type === 'SALE_COMPLETED' || n.entity_type === 'sale') {
      navigate('/sales');
    } else if (n.type === 'USER_ADDED' || n.entity_type === 'user') {
      navigate('/users');
    }
  };

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'badge-owner';
      case 'MANAGER':
        return 'badge-manager';
      case 'CASHIER':
        return 'badge-cashier';
      default:
        return 'badge-active';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return dateStr;
    }
  };

  const getNotificationIcon = (type: string, entityType?: string) => {
    if (type === 'LOW_STOCK' || type === 'OUT_OF_STOCK') return <Package size={16} style={{ color: 'var(--color-pink)' }} />;
    if (type === 'EXPENSE_RECORDED' || entityType === 'expense') return <DollarSign size={16} style={{ color: 'var(--color-orange)' }} />;
    if (type === 'SALE_COMPLETED' || entityType === 'sale') return <Receipt size={16} style={{ color: 'var(--color-purple)' }} />;
    if (type === 'USER_ADDED' || entityType === 'user') return <Users size={16} style={{ color: 'var(--color-coral)' }} />;
    return <AlertCircle size={16} style={{ color: 'var(--color-pink)' }} />;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="app-header">
      {/* Mobile Hamburger & Search Input Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1', maxWidth: '440px', minWidth: 0 }}>
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="mobile-hamburger-btn btn btn-ghost btn-sm"
            aria-label="Open Navigation Menu"
            style={{ padding: '0.375rem', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
          >
            <Menu size={22} style={{ color: 'var(--text-primary)' }} />
          </button>
        )}

        <form onSubmit={handleSearchSubmit} style={{ flex: '1', position: 'relative', minWidth: 0 }} className="search-container">
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, customers... (Enter)"
            className="form-input"
            style={{
              paddingLeft: '38px',
              paddingRight: '48px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              fontSize: '0.84rem',
            }}
          />
          <div
            className="search-shortcut-badge"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            ⌘K
          </div>
        </form>
      </div>

      {/* Right Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="header-actions">
        {/* Network Status Pill */}
        {renderNetworkBadge()}

        {/* Quick Launch POS Terminal */}
        <Link to="/pos" className="btn btn-primary btn-sm" style={{ height: '38px', gap: '0.5rem', borderRadius: 'var(--radius-md)' }}>
          <ShoppingCart size={16} />
          <span>POS Terminal</span>
        </Link>

        {/* Notifications Icon with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleToggleNotifications}
            className="btn btn-secondary btn-sm"
            style={{
              width: '38px',
              height: '38px',
              padding: 0,
              borderRadius: 'var(--radius-md)',
              position: 'relative',
            }}
            title="Notifications"
          >
            <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  borderRadius: '9px',
                  backgroundColor: 'var(--color-pink)',
                  color: '#FFFFFF',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #FFFFFF',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Center Dropdown */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '115%',
                width: '340px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 300,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Notification Center
                  </span>
                  {unreadCount > 0 && (
                    <span className="badge badge-pink" style={{ padding: '2px 6px', fontSize: '0.6875rem' }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-pink)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification List Container */}
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {loadingNotifications ? (
                  <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                    <Bell size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>No notifications yet</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Stock warnings, sale alerts, and system events will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        backgroundColor: n.is_read ? '#FFFFFF' : 'rgba(244, 63, 122, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="dropdown-item"
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {getNotificationIcon(n.type, n.entity_type)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: n.is_read ? 600 : 800, color: 'var(--text-primary)' }}>
                            {n.title}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatTimeAgo(n.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.35 }}>
                          {n.message}
                        </p>
                      </div>

                      {!n.is_read && (
                        <div
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-pink)',
                            marginTop: '6px',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Pill Dropdown */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                setShowNotifications(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user.name}
                  </span>
                  <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ padding: '1px 5px', fontSize: '0.6875rem' }}>
                    {user.role}
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                  {business?.name || 'ZYLIX Store'}
                </span>
              </div>

              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Account Dropdown Menu */}
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '115%',
                  width: '200px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.375rem',
                  zIndex: 200,
                }}
              >
                <Link
                  to="/profile"
                  onClick={() => setShowDropdown(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="dropdown-item"
                >
                  <UserIcon size={16} />
                  <span>My Profile</span>
                </Link>

                {user?.isPlatformOwner && (
                  <Link
                    to="/platform/tenants"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      color: 'var(--color-pink)',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="dropdown-item"
                  >
                    <UserIcon size={16} />
                    <span>Platform Tenants</span>
                  </Link>
                )}
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    logout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-danger)',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
