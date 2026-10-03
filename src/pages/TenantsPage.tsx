import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import {
  Building2,
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  Shield,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  DollarSign,
  Receipt,
  X,
  Calendar,
  AlertCircle,
  Eye,
  Activity,
  Boxes,
  ArrowLeft,
  PieChart,
  ShoppingBag,
  Clock
} from 'lucide-react';

interface TenantItem {
  id: string;
  business_name: string;
  business_type: string;
  business_phone?: string;
  business_email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  tax_number?: string;
  currency?: string;
  timezone?: string;
  description?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  created_at: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  total_users: number;
  total_products: number;
  total_customers: number;
  total_sales: number;
  total_revenue: number;
  platform_collected_revenue?: number;
  initial_payment_total?: number;
  monthly_subscription_total?: number;
  last_activity?: string;
}

interface SummaryMetrics {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  pending_tenants?: number;
  total_users: number;
  total_products: number;
  total_sales: number;
  total_revenue: number;
  platform_collected_revenue?: number;
  total_initial_payments?: number;
  total_subscriptions?: number;
}

export const TenantsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { businessId } = useParams<{ businessId?: string }>();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);

  // Modal & Detail States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Record Revenue Modal State
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revenueTenant, setRevenueTenant] = useState<any | null>(null);
  const [revenueForm, setRevenueForm] = useState({
    paymentType: 'MONTHLY_SUBSCRIPTION' as 'INITIAL_PAYMENT' | 'MONTHLY_SUBSCRIPTION' | 'OTHER',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI' as 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'OTHER',
    notes: '',
  });
  const [revenueSaving, setRevenueSaving] = useState(false);

  const handleOpenRevenueModal = (t: any) => {
    setRevenueTenant(t);
    setRevenueForm({
      paymentType: 'MONTHLY_SUBSCRIPTION',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      notes: '',
    });
    setShowRevenueModal(true);
  };

  const handleSaveRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revenueTenant) return;
    const numericAmount = parseFloat(revenueForm.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast('Please enter a valid positive payment amount', 'warning');
      return;
    }

    try {
      setRevenueSaving(true);
      const res = await apiFetch(`/tenants/${revenueTenant.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paymentType: revenueForm.paymentType,
          amount: numericAmount,
          paymentDate: revenueForm.paymentDate,
          paymentMethod: revenueForm.paymentMethod,
          notes: revenueForm.notes,
        }),
      });

      if (res.success) {
        showToast(res.message || 'Platform revenue recorded successfully!', 'success');
        setShowRevenueModal(false);
        if (businessId) {
          fetchTenantDetail(businessId);
        } else {
          fetchTenants();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record platform revenue', 'error');
    } finally {
      setRevenueSaving(false);
    }
  };

  // Date Filter for Detail View
  const [dateRange, setDateRange] = useState('last30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'Retail POS',
    businessPhone: '',
    businessEmail: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    taxNumber: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    description: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    password: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'PENDING',
  });

  useEffect(() => {
    if ((user as any)?.isPlatformOwner) {
      if (businessId) {
        fetchTenantDetail(businessId);
      } else {
        fetchTenants();
      }
    }
  }, [businessId, page, statusFilter, search, dateRange, startDate, endDate]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/tenants?page=${page}&limit=10`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;

      const res = await apiFetch(query);
      if (res.success) {
        setTenants(res.items || []);
        setSummary(res.summary || null);
        setTotalPages(res.totalPages || 1);
        setTotalTenants(res.total || 0);
      } else {
        setError(res.message || 'Failed to fetch platform tenants.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantDetail = async (id: string) => {
    try {
      setDetailsLoading(true);
      setError(null);
      let query = `/tenants/${id}?range=${dateRange}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;

      const res = await apiFetch(query);
      if (res.success) {
        setTenantDetails(res);
      } else {
        setError(res.message || 'Tenant record not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching tenant details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      businessName: '',
      businessType: 'Retail POS',
      businessPhone: '',
      businessEmail: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      taxNumber: '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      description: '',
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      password: '',
      status: 'ACTIVE',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (t: TenantItem) => {
    setSelectedTenant(t);
    setFormData({
      businessName: t.business_name || '',
      businessType: t.business_type || 'Retail POS',
      businessPhone: t.business_phone || '',
      businessEmail: t.business_email || '',
      address: t.address || '',
      city: t.city || '',
      state: t.state || '',
      country: t.country || 'India',
      taxNumber: t.tax_number || '',
      currency: t.currency || 'INR',
      timezone: t.timezone || 'Asia/Kolkata',
      description: t.description || '',
      ownerName: t.owner_name || '',
      ownerEmail: t.owner_email || '',
      ownerPhone: '',
      password: '',
      status: t.status,
    });
    setShowEditModal(true);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName || !formData.ownerEmail || !formData.password) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch('/tenants', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        showToast(res.message || 'Platform tenant created successfully!', 'success');
        setShowAddModal(false);
        fetchTenants();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create tenant', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      setActionLoading(true);
      const res = await apiFetch(`/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        showToast('Tenant details updated successfully!', 'success');
        setShowEditModal(false);
        if (businessId) {
          fetchTenantDetail(businessId);
        } else {
          fetchTenants();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update tenant', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveTenant = async (t: TenantItem) => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/tenants/${t.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      if (res.success) {
        showToast(`Tenant '${t.business_name}' approved successfully! Account is now active.`, 'success');
        fetchTenants();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to approve tenant', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTenant = async (t: TenantItem) => {
    if (!window.confirm(`Are you sure you want to reject the registration request for '${t.business_name}'?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/tenants/${t.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SUSPENDED' }),
      });

      if (res.success) {
        showToast(`Registration request for '${t.business_name}' rejected.`, 'info');
        fetchTenants();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reject tenant', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (t: TenantItem) => {
    const newStatus = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to set '${t.business_name}' to ${newStatus}?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/tenants/${t.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.success) {
        showToast(`Tenant status set to ${newStatus}`, 'success');
        if (businessId) {
          fetchTenantDetail(businessId);
        } else {
          fetchTenants();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const formatCurrency = (val: number, symbol = '₹') => {
    return `${symbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!(user as any)?.isPlatformOwner) {
    return (
      <div className="zylix-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '3rem auto' }}>
        <Shield size={48} style={{ color: 'var(--color-danger)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>HTTP 403 — Access Forbidden</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Platform Tenant Management is restricted strictly to authorized ZYLIX Platform Administrators. Normal business tenant accounts cannot access cross-business administration.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  // DETAILED SINGLE TENANT MONITORING VIEW
  if (businessId) {
    const t = tenantDetails?.tenant;
    const stats = tenantDetails?.stats || {};
    const recentSales = tenantDetails?.recentSales || [];
    const recentExpenses = tenantDetails?.recentExpenses || [];
    const recentAuditLogs = tenantDetails?.recentAuditLogs || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
        
        {/* Header & Back Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/platform/tenants')}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.5rem 0.875rem' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Tenants</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {t?.name || 'Loading Tenant...'}
                </h1>
                <span className={`badge ${t?.status === 'SUSPENDED' ? 'badge-inactive' : 'badge-active'}`}>
                  {t?.status || 'ACTIVE'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                Owner: <strong>{t?.owner_name || 'N/A'}</strong> ({t?.owner_email || 'N/A'}) • Created {t?.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => fetchTenantDetail(businessId)} className="btn btn-secondary btn-sm">
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
            {t && (
              <button
                onClick={() => handleToggleStatus({ id: t.id, business_name: t.name, status: t.status } as any)}
                className={`btn btn-sm ${t.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
              >
                <Power size={15} />
                <span>{t.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}</span>
              </button>
            )}
          </div>
        </div>

        {detailsLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem' }} />
            <p>Loading real-time SQL database tenant metrics...</p>
          </div>
        ) : error ? (
          <div className="zylix-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger)' }}>
            <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Filter Date Range Selector */}
            <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Calendar size={18} style={{ color: 'var(--color-pink)' }} />
                <span>Filter Activity Period:</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  className="form-select"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ width: '180px', fontSize: '0.8125rem' }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="prevMonth">Previous Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>

                {dateRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: '0.8125rem' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                    <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ fontSize: '0.8125rem' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.375rem 0' }}>{formatCurrency(stats.totalRevenue || 0)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From {stats.totalSales || 0} completed orders</div>
              </div>

              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Expenses</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)', margin: '0.375rem 0' }}>{formatCurrency(stats.totalExpenses || 0)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recorded store operating expenses</div>
              </div>

              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Estimated Profit</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: (stats.estimatedProfit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)', margin: '0.375rem 0' }}>
                  {formatCurrency(stats.estimatedProfit || 0)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revenue − COGS − Expenses</div>
              </div>

              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Inventory Valuation</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.375rem 0' }}>{formatCurrency(stats.inventoryValuation || 0)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across {stats.totalProducts || 0} active products</div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="zylix-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <Users size={24} style={{ color: 'var(--color-purple)' }} />
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalUsers || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Staff Users ({stats.activeUsers || 0} Active)</div>
                </div>
              </div>

              <div className="zylix-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <ShoppingBag size={24} style={{ color: 'var(--color-coral)' }} />
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalCustomers || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Registered Customers</div>
                </div>
              </div>

              <div className="zylix-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <Boxes size={24} style={{ color: 'var(--color-pink)' }} />
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: stats.lowStockCount > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{stats.lowStockCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Low-Stock Alerts</div>
                </div>
              </div>
            </div>

            {/* Recent Sales & Recent Expenses Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} style={{ color: 'var(--color-pink)' }} /> Recent Sales Activity
                </h3>
                {recentSales.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No sales activity recorded yet.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.5rem 0' }}>Invoice</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th style={{ textAlign: 'right' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((s: any) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0', fontWeight: 700 }}>#{s.invoice_number}</td>
                          <td>{s.payment_method}</td>
                          <td style={{ fontWeight: 700 }}>{formatCurrency(s.grand_total)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="zylix-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={18} style={{ color: 'var(--color-coral)' }} /> Recent Operating Expenses
                </h3>
                {recentExpenses.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No expenses recorded yet.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.5rem 0' }}>Title</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th style={{ textAlign: 'right' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentExpenses.map((e: any) => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0', fontWeight: 700 }}>{e.title}</td>
                          <td>{e.category}</td>
                          <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{formatCurrency(e.amount)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Platform Revenue & Subscriptions */}
            <div className="zylix-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign size={18} style={{ color: '#10B981' }} /> Platform Revenue & Subscriptions
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                    Recorded setup fees and recurring subscription payments collected from <strong>{t?.name}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue Collected</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#10B981' }}>{formatCurrency(stats.platformCollectedRevenue || 0)}</div>
                  </div>
                  <button
                    onClick={() => handleOpenRevenueModal({ id: t.id, business_name: t.name, status: t.status } as any)}
                    className="btn btn-sm"
                    style={{ backgroundColor: '#10B981', color: '#FFFFFF', fontWeight: 700 }}
                  >
                    <Plus size={14} /> Record Revenue
                  </button>
                </div>
              </div>

              {(!tenantDetails?.tenantPayments || tenantDetails.tenantPayments.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  No platform subscription or initial payments recorded yet for this tenant. Click <strong>Record Revenue</strong> to add payment.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)' }}>
                        <th style={{ padding: '0.625rem 0.875rem' }}>Date</th>
                        <th style={{ padding: '0.625rem 0.875rem' }}>Category / Type</th>
                        <th style={{ padding: '0.625rem 0.875rem' }}>Method</th>
                        <th style={{ padding: '0.625rem 0.875rem' }}>Notes / Ref</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantDetails.tenantPayments.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.625rem 0.875rem', fontWeight: 700 }}>
                            {new Date(p.payment_date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.625rem 0.875rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                backgroundColor: p.payment_type === 'INITIAL_PAYMENT' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: p.payment_type === 'INITIAL_PAYMENT' ? '#A855F7' : '#10B981',
                              }}
                            >
                              {p.payment_type === 'INITIAL_PAYMENT'
                                ? 'Initial Setup Fee'
                                : p.payment_type === 'MONTHLY_SUBSCRIPTION'
                                ? 'Monthly Subscription'
                                : 'Other Payment'}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 0.875rem' }}>{p.payment_method}</td>
                          <td style={{ padding: '0.625rem 0.875rem', color: 'var(--text-secondary)' }}>{p.notes || '—'}</td>
                          <td style={{ padding: '0.625rem 0.875rem', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}

      </div>
    );
  }

  // MAIN PLATFORM TENANTS OVERVIEW LIST
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Platform Tenants
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage and monitor businesses using ZYLIX POS.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING');
              setPage(1);
            }}
            className="btn btn-secondary btn-sm"
            style={{
              backgroundColor: statusFilter === 'PENDING' ? '#FEF3C7' : 'rgba(244, 63, 122, 0.08)',
              color: statusFilter === 'PENDING' ? '#D97706' : 'var(--color-pink)',
              borderColor: statusFilter === 'PENDING' ? '#F59E0B' : 'rgba(244, 63, 122, 0.3)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
            title="View Pending Tenant Registration Requests"
          >
            <Clock size={15} />
            <span>New Tenant Requests</span>
            {(summary?.pending_tenants || 0) > 0 && (
              <span
                style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {summary?.pending_tenants}
              </span>
            )}
          </button>

          <button onClick={fetchTenants} className="btn btn-secondary btn-sm" title="Refresh Database Statistics">
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>

          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>Add Tenant</span>
          </button>
        </div>
      </div>

      {/* Global Platform Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="zylix-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Tenants</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{summary.total_tenants || 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
              {summary.active_tenants || 0} Active • {summary.suspended_tenants || 0} Suspended • {summary.pending_tenants || 0} Pending
            </div>
          </div>

          <div className="zylix-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Platform Users</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{summary.total_users || 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Across all businesses</div>
          </div>

          <div className="zylix-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Platform Subscriptions</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#10B981', marginTop: '0.25rem' }}>{formatCurrency(summary.platform_collected_revenue || 0)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Initial: {formatCurrency(summary.total_initial_payments || 0)} • Monthly: {formatCurrency(summary.total_subscriptions || 0)}
            </div>
          </div>

          <div className="zylix-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tenant Store Revenue</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-pink)', marginTop: '0.25rem' }}>{formatCurrency(summary.total_revenue || 0)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>From {summary.total_sales || 0} tenant sales</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by business, owner, city, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ width: '180px', fontSize: '0.875rem' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE Only</option>
            <option value="SUSPENDED">SUSPENDED Only</option>
            <option value="PENDING">PENDING Requests</option>
          </select>
        </div>
      </div>

      {/* Main Tenant Table */}
      <div className="zylix-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '0.75rem' }} />
            <p>Querying real database tenant statistics...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-danger)' }}>
            <AlertCircle size={32} style={{ marginBottom: '0.75rem' }} />
            <p style={{ fontWeight: 700 }}>{error}</p>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Building2 size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Tenants Found</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>No business tenants match your current filter parameters.</p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd} style={{ margin: '0 auto' }}>
              <Plus size={16} />
              <span>Create First Tenant</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="zylix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Business Name</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Owner</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>City / Phone</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Platform Revenue</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Store Revenue</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.business_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.business_type || 'Store'}</div>
                    </td>

                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.owner_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.owner_email || 'N/A'}</div>
                    </td>

                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.city || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.business_phone || 'N/A'}</div>
                    </td>

                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span
                        className={`badge ${
                          t.status === 'SUSPENDED'
                            ? 'badge-inactive'
                            : t.status === 'PENDING'
                            ? 'badge-warning'
                            : 'badge-active'
                        }`}
                        style={
                          t.status === 'PENDING'
                            ? { backgroundColor: '#FEF3C7', color: '#D97706', fontWeight: 800 }
                            : undefined
                        }
                      >
                        {t.status === 'PENDING' ? 'PENDING APPROVAL' : t.status}
                      </span>
                    </td>

                    <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: '#10B981' }}>
                      {formatCurrency(t.platform_collected_revenue || 0)}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(t.total_revenue || 0)}
                    </td>

                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      {t.status === 'PENDING' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleApproveTenant(t)}
                            className="btn btn-sm"
                            style={{ backgroundColor: '#16A34A', color: '#FFFFFF', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 700 }}
                            title="Approve Tenant Registration Request"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectTenant(t)}
                            className="btn btn-sm"
                            style={{ backgroundColor: '#EF4444', color: '#FFFFFF', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 700 }}
                            title="Reject Registration Request"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleOpenRevenueModal(t)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                            title="Record Initial Payment or Monthly Subscription Revenue"
                          >
                            <DollarSign size={14} /> Revenue
                          </button>
                          <button
                            onClick={() => navigate(`/platform/tenants/${t.id}`)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="View Live Tenant Monitoring"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Edit Business Details"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t)}
                            className={`btn btn-sm ${t.status === 'ACTIVE' ? 'btn-ghost' : 'btn-success'}`}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              color: t.status === 'ACTIVE' ? 'var(--color-danger)' : undefined,
                            }}
                            title={t.status === 'ACTIVE' ? 'Suspend Tenant Access' : 'Reactivate Tenant Access'}
                          >
                            <Power size={14} /> {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD TENANT MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="zylix-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Create New Platform Tenant</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-pink)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Business Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Business Name *</label>
                    <input type="text" required className="form-input" placeholder="e.g. Apex Electronics" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Category</label>
                    <input type="text" className="form-input" placeholder="e.g. Grocery / Supermarket" value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Business Email</label>
                    <input type="email" className="form-input" placeholder="contact@apex.com" value={formData.businessEmail} onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Phone</label>
                    <input type="text" className="form-input" placeholder="+91 9876543210" value={formData.businessPhone} onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" className="form-input" placeholder="Mumbai" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" className="form-input" placeholder="Maharashtra" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input type="text" className="form-input" placeholder="India" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tax / GST Number</label>
                    <input type="text" className="form-input" placeholder="27ABCDE1234F1Z5" value={formData.taxNumber} onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select className="form-select" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-pink)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0 0' }}>
                  Owner User Details
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Owner Name *</label>
                    <input type="text" required className="form-input" placeholder="Rabeeh Owner" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner Email *</label>
                    <input type="email" required className="form-input" placeholder="owner@store.com" value={formData.ownerEmail} onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Initial Password *</label>
                    <input type="password" required minLength={6} className="form-input" placeholder="Password123!" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Account Status</label>
                    <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary">
                    {actionLoading ? 'Creating Tenant...' : 'Create Tenant'}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TENANT MODAL */}
      {showEditModal && selectedTenant && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="zylix-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Edit Tenant ({selectedTenant.business_name})</h2>
              <button onClick={() => setShowEditModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTenant}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Business Name</label>
                    <input type="text" required className="form-input" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Category</label>
                    <input type="text" className="form-input" value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Owner Name</label>
                    <input type="text" required className="form-input" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner Email</label>
                    <input type="email" required className="form-input" value={formData.ownerEmail} onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select className="form-select" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary">
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD TENANT REVENUE MODAL */}
      {showRevenueModal && revenueTenant && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="zylix-card" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={20} style={{ color: '#10B981' }} /> Record Tenant Revenue
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Business: <strong>{revenueTenant.business_name}</strong>
                </p>
              </div>
              <button onClick={() => setShowRevenueModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRevenue}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div className="form-group">
                  <label className="form-label">Payment Category / Type *</label>
                  <select
                    className="form-select"
                    value={revenueForm.paymentType}
                    onChange={(e) => setRevenueForm({ ...revenueForm, paymentType: e.target.value as any })}
                  >
                    <option value="INITIAL_PAYMENT">Initial Setup Payment (Onboarding Fee)</option>
                    <option value="MONTHLY_SUBSCRIPTION">Monthly Subscription Fee</option>
                    <option value="OTHER">Other Custom Payment / Service</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={revenueForm.amount}
                      onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={revenueForm.paymentDate}
                      onChange={(e) => setRevenueForm({ ...revenueForm, paymentDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="form-select"
                    value={revenueForm.paymentMethod}
                    onChange={(e) => setRevenueForm({ ...revenueForm, paymentMethod: e.target.value as any })}
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="BANK_TRANSFER">Bank Direct Transfer / NEFT / IMPS</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="CASH">Cash Payment</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Transaction Reference</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. UTR #123456789 or Subscription for October 2026"
                    value={revenueForm.notes}
                    onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" onClick={() => setShowRevenueModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={revenueSaving}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
                  >
                    {revenueSaving ? 'Recording Revenue...' : 'Save Payment'}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TenantsPage;
