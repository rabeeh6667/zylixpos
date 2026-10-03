import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText
} from 'lucide-react';

interface AuditItem {
  id: string;
  business_id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export const ActivityPage: React.FC = () => {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const limit = 15;

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (search.trim()) query.set('search', search.trim());
      if (actionFilter) query.set('action', actionFilter);
      if (entityFilter) query.set('entityType', entityFilter);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);

      const res = await apiFetch(`/api/audit-logs?${query.toString()}`);
      if (res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, actionFilter, entityFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('PASSWORD')) {
      return 'badge-info';
    }
    if (action.includes('CREATED') || action.includes('COMPLETED') || action.includes('STOCK_IN')) {
      return 'badge-success';
    }
    if (action.includes('ARCHIVED') || action.includes('DEACTIVATED') || action.includes('FAILED') || action.includes('STOCK_OUT')) {
      return 'badge-warning';
    }
    return 'badge-active';
  };

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Activity size={24} style={{ color: 'var(--color-pink)' }} />
            <span>Activity & Audit Log</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Real-time audit trail of all business events, staff actions, and security operations.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          
          {/* Search Box */}
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Search Audit Trail
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px', height: '38px', fontSize: '0.84rem' }}
                placeholder="Action, description, metadata..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Action Select */}
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Action Type
            </label>
            <select
              className="form-input"
              style={{ height: '38px', fontSize: '0.84rem' }}
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Actions</option>
              <optgroup label="Authentication">
                <option value="LOGIN">LOGIN</option>
                <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
              </optgroup>
              <optgroup label="Staff Users">
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="USER_ARCHIVED">USER_ARCHIVED</option>
                <option value="ROLE_CHANGED">ROLE_CHANGED</option>
              </optgroup>
              <optgroup label="Products & Stock">
                <option value="PRODUCT_CREATED">PRODUCT_CREATED</option>
                <option value="PRODUCT_UPDATED">PRODUCT_UPDATED</option>
                <option value="PRODUCT_ARCHIVED">PRODUCT_ARCHIVED</option>
                <option value="STOCK_IN">STOCK_IN</option>
                <option value="STOCK_OUT">STOCK_OUT</option>
                <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
              </optgroup>
              <optgroup label="POS & Sales">
                <option value="SALE_CREATED">SALE_CREATED</option>
                <option value="SALE_COMPLETED">SALE_COMPLETED</option>
                <option value="PAYMENT_CREATED">PAYMENT_CREATED</option>
                <option value="SALE_HELD">SALE_HELD</option>
                <option value="SALE_RESUMED">SALE_RESUMED</option>
              </optgroup>
              <optgroup label="Customers & Expenses">
                <option value="CUSTOMER_CREATED">CUSTOMER_CREATED</option>
                <option value="CUSTOMER_UPDATED">CUSTOMER_UPDATED</option>
                <option value="CUSTOMER_ARCHIVED">CUSTOMER_ARCHIVED</option>
                <option value="EXPENSE_CREATED">EXPENSE_CREATED</option>
                <option value="EXPENSE_UPDATED">EXPENSE_UPDATED</option>
                <option value="EXPENSE_ARCHIVED">EXPENSE_ARCHIVED</option>
              </optgroup>
              <optgroup label="Settings">
                <option value="BUSINESS_SETTINGS_UPDATED">BUSINESS_SETTINGS_UPDATED</option>
                <option value="RECEIPT_SETTINGS_UPDATED">RECEIPT_SETTINGS_UPDATED</option>
              </optgroup>
            </select>
          </div>

          {/* Entity Type Select */}
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Entity
            </label>
            <select
              className="form-input"
              style={{ height: '38px', fontSize: '0.84rem' }}
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Entities</option>
              <option value="user">User</option>
              <option value="product">Product</option>
              <option value="sale">Sale / Invoice</option>
              <option value="customer">Customer</option>
              <option value="expense">Expense</option>
              <option value="settings">Settings</option>
              <option value="held_sale">Held Sale</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Start Date
            </label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '0.84rem' }}
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              End Date
            </label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '0.84rem' }}
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>

          {/* Reset Action */}
          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-ghost btn-sm"
              style={{ height: '38px', width: '100%', fontSize: '0.8125rem' }}
            >
              Reset Filters
            </button>
          </div>
        </form>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem', color: 'var(--color-pink)' }} />
            <p>Loading activity logs...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: 'var(--text-muted)',
              }}
            >
              <Activity size={32} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              No activity yet
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
              No audit records match your criteria. Operations like logins, POS sales, stock updates, and setting changes will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Entity</th>
                    <th>Description & Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {formatTimestamp(item.created_at)}
                      </td>
                      <td>
                        <span className={`badge ${getActionBadgeClass(item.action)}`} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {item.action}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={14} style={{ color: 'var(--text-muted)' }} />
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.user_name || 'System'}
                            </div>
                            {item.user_email && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {item.user_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {item.entity_type || 'N/A'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        <div>{item.description || item.action}</div>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <div
                            style={{
                              marginTop: '4px',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                              backgroundColor: 'var(--bg-subtle)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              maxWidth: '400px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {JSON.stringify(item.metadata)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                padding: '0.875rem 1.25rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-subtle)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> activity records
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '32px', width: '32px', padding: 0 }}
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ fontSize: '0.8125rem', fontWeight: 600, padding: '0 0.5rem' }}>
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ height: '32px', width: '32px', padding: 0 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
