import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Customer } from '../types/index.ts';
import { KPICard } from '../components/ui/Card.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { StatusBadge } from '../components/ui/Badge.tsx';
import {
  Users,
  UserPlus,
  TrendingUp,
  Search,
  Eye,
  Edit3,
  Archive,
  Receipt,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer Detail & Purchase History Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{ customer: any; history: any[] } | null>(null);

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const res = await apiFetch(`/customers${query}`);
      if (res.success) setCustomers(res.customers || []);
    } catch (err: any) {
      showToast('Failed to load customer registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = editingCustomer ? `/customers/${editingCustomer.id}` : '/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(form),
      });

      if (res.success) {
        showToast(editingCustomer ? 'Customer updated!' : 'Customer created!', 'success');
        setIsModalOpen(false);
        fetchCustomers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive customer '${name}'?`)) return;

    try {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast(`Customer '${name}' archived`, 'success');
        fetchCustomers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to archive customer', 'error');
    }
  };

  const handleViewCustomerHistory = async (c: any) => {
    try {
      const res = await apiFetch(`/customers/${c.id}`);
      if (res.success) {
        setSelectedDetail({ customer: res.customer, history: res.purchaseHistory || [] });
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      showToast('Failed to load customer purchase history', 'error');
    }
  };

  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const totalSpentAll = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0);
  const totalOrdersAll = customers.reduce((acc, c) => acc + (c.total_orders || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Customer Registry & History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Customer profiles, order frequency, and purchase history.
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary">
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KPICard
          title="Total Customers"
          value={customers.length}
          subtitle="Registered profiles"
          icon={Users}
          iconBg="var(--bg-purple-pastel)"
          iconColor="var(--color-purple)"
        />
        <KPICard
          title="Total Customer Orders"
          value={totalOrdersAll}
          subtitle="Completed sales"
          icon={Receipt}
          iconBg="var(--bg-pink-pastel)"
          iconColor="var(--color-pink)"
        />
        <KPICard
          title="Lifetime Customer Revenue"
          value={formatCurrency(totalSpentAll)}
          subtitle="Sales value"
          icon={TrendingUp}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
        />
      </div>

      {/* Search Bar */}
      <div className="zylix-card" style={{ padding: '0.875rem 1.25rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            className="form-input"
            style={{ paddingLeft: '38px', height: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customer directory...</div>
        ) : customers.length === 0 ? (
          <EmptyState title="No Customers Found" description="Register your first store customer to track purchase orders." />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Email Address</th>
                <th>Total Orders</th>
                <th>Total Spent</th>
                <th>Last Purchase</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                    {c.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.notes}</div>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.phone || 'N/A'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.email || 'N/A'}</td>
                  <td>
                    <span className="badge badge-manager">{c.total_orders || 0} orders</span>
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--color-pink)' }}>
                    {formatCurrency(c.total_spent || 0)}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString() : 'No orders'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        onClick={() => handleViewCustomerHistory(c)}
                        className="btn btn-ghost btn-sm"
                        title="View Purchase History"
                      >
                        <Eye size={16} /> History
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="btn btn-ghost btn-sm"
                        title="Edit Customer"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleArchiveCustomer(c.id, c.name)}
                        className="btn btn-ghost btn-sm"
                        title="Archive Customer"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Register New Customer'}
      >
        <form onSubmit={handleSaveCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="rahul@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="City, State"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={2}
                className="form-textarea"
                placeholder="Customer preferences or notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Customer Profile'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Customer History Drawer Modal */}
      {selectedDetail && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Purchase History: ${selectedDetail.customer.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Orders Placed</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedDetail.customer.total_orders || 0} orders</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Spent</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-pink)' }}>
                  {formatCurrency(selectedDetail.customer.total_spent || 0)}
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>Recent Purchases</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '300px', overflowY: 'auto' }}>
              {selectedDetail.history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No purchase invoices found for this customer.</p>
              ) : (
                selectedDetail.history.map((s: any) => (
                  <div key={s.id} style={{ padding: '0.75rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--color-pink)' }}>#{s.invoice_number}</span>
                      <span style={{ fontWeight: 800 }}>{formatCurrency(s.grand_total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>Date: {new Date(s.created_at).toLocaleDateString()}</span>
                      <span>Payment: {s.payment_method}</span>
                    </div>
                    {s.items && s.items.length > 0 && (
                      <div style={{ marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: '1px dashed var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Items: {s.items.map((i: any) => `${i.product_name} (x${i.quantity})`).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setIsDetailModalOpen(false)} className="btn btn-primary">
                Close History
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
