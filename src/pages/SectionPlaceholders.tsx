import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { KPICard } from '../components/ui/Card.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import {
  Users,
  UserPlus,
  DollarSign,
  Plus,
  BarChart3,
  TrendingUp,
  Receipt,
  Truck,
  CreditCard,
  Building2,
  Calendar,
  ChevronDown
} from 'lucide-react';

/* ====================================================================
 * 1. CUSTOMERS PAGE
 * ==================================================================== */
export const CustomersPage: React.FC = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/customers');
      if (res.success) setCustomers(res.customers || []);
    } catch (err) {
      showToast('Failed to load customer registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.success) {
        showToast('Customer registered successfully!', 'success');
        setIsAddModalOpen(false);
        setForm({ name: '', phone: '', email: '', address: '' });
        fetchCustomers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN')}`;

  const totalSpent = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Customer Registry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage customer profiles, contact info, and total purchase history.
          </p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

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
          title="Total Customer Lifetime Spent"
          value={formatCurrency(totalSpent)}
          subtitle="Revenue generated"
          icon={TrendingUp}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
        />
      </div>

      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers...</div>
        ) : customers.length === 0 ? (
          <EmptyState title="No Customers Found" description="Register your first store customer to track purchase orders." />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Email Address</th>
                <th>Address</th>
                <th>Total Spent</th>
                <th>Registered Date</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.phone || 'N/A'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.email || 'N/A'}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{c.address || 'N/A'}</td>
                  <td style={{ fontWeight: 800, color: 'var(--color-pink)' }}>{formatCurrency(c.total_spent || 0)}</td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Customer">
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
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
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="rahul@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ====================================================================
 * 2. SUPPLIERS PAGE
 * ==================================================================== */
export const SuppliersPage: React.FC = () => {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([
    { id: '1', name: 'Metro Wholesalers Ltd', contact: 'Rajesh Kumar', phone: '+91 9811223344', email: 'orders@metrowholesale.com', category: 'General Goods' },
    { id: '2', name: 'Apex Dairy Supplies', contact: 'Sunil Verma', phone: '+91 9877665544', email: 'dairy@apexdairy.com', category: 'Dairy & Beverages' },
    { id: '3', name: 'Global Beverage Importers', contact: 'Anjali Gupta', phone: '+91 9911002299', email: 'sales@globalbev.in', category: 'Beverages' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Suppliers & Vendors
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage wholesaler contact details, categories, and purchase orders.
          </p>
        </div>
        <button onClick={() => showToast('Supplier creation dialog ready', 'info')} className="btn btn-primary">
          <Truck size={18} /> Add Supplier
        </button>
      </div>

      <div className="zylix-table-container">
        <table className="zylix-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.contact}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.phone}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                <td>
                  <span className="badge badge-manager">{s.category}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ====================================================================
 * 3. EXPENSES PAGE
 * ==================================================================== */
export const ExpensesPage: React.FC = () => {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([
    { id: '1', category: 'Utilities', amount: 1450, description: 'Store Electricity Bill Sept 2026', created_at: new Date().toISOString() },
    { id: '2', category: 'Store Rent', amount: 12000, description: 'Monthly Retail Store Premises Rent', created_at: new Date().toISOString() },
    { id: '3', category: 'Maintenance', amount: 650, description: 'POS Thermal Printer Paper Roll Pack', created_at: new Date().toISOString() },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Expense Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Record operating overheads, shop rent, electricity, and maintenance costs.
          </p>
        </div>
        <button onClick={() => showToast('Expense entry dialog ready', 'info')} className="btn btn-primary">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KPICard
          title="Total Expenses"
          value="₹14,100"
          subtitle="Current Month"
          icon={DollarSign}
          iconBg="var(--color-danger-bg)"
          iconColor="var(--color-danger)"
        />
        <KPICard
          title="Highest Category"
          value="Store Rent"
          subtitle="₹12,000 / mo"
          icon={Receipt}
          iconBg="var(--bg-amber-pastel)"
          iconColor="var(--color-warning)"
        />
      </div>

      <div className="zylix-table-container">
        <table className="zylix-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </td>
                <td>
                  <span className="badge badge-cashier">{e.category}</span>
                </td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.description}</td>
                <td style={{ fontWeight: 800, color: 'var(--color-danger)' }}>₹{e.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ====================================================================
 * 4. REPORTS PAGE
 * ==================================================================== */
export const ReportsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Business Analytics & Reports
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Financial summaries, revenue trends, category breakdown, and tax reports.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)' }}>
          <Calendar size={16} style={{ color: 'var(--color-pink)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>This Month (Sept 2026)</span>
          <ChevronDown size={14} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KPICard
          title="Total Gross Revenue"
          value="₹1,84,500"
          subtitle="↑ 16% vs last month"
          icon={TrendingUp}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
        />
        <KPICard
          title="Total Orders Processed"
          value="642"
          subtitle="↑ 12% vs last month"
          icon={BarChart3}
          iconBg="var(--bg-pink-pastel)"
          iconColor="var(--color-pink)"
        />
        <KPICard
          title="Net Profit Margin"
          value="₹62,400"
          subtitle="33.8% Margin"
          icon={DollarSign}
          iconBg="var(--bg-purple-pastel)"
          iconColor="var(--color-purple)"
        />
        <KPICard
          title="Tax Collected (GST)"
          value="₹16,605"
          subtitle="18% Tax Rate"
          icon={Receipt}
          iconBg="var(--bg-blue-pastel)"
          iconColor="var(--color-info)"
        />
      </div>

      {/* Category Sales Breakdown Progress Bars */}
      <div className="zylix-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Category Revenue Distribution</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
              <span style={{ fontWeight: 700 }}>Beverages & Coffee</span>
              <span style={{ fontWeight: 800 }}>₹74,800 (40.5%)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: '40.5%', height: '100%', background: 'var(--gradient-primary)', borderRadius: '9999px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
              <span style={{ fontWeight: 700 }}>Bakery & Snacks</span>
              <span style={{ fontWeight: 800 }}>₹58,200 (31.5%)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: '31.5%', height: '100%', background: 'var(--gradient-primary)', borderRadius: '9999px' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
              <span style={{ fontWeight: 700 }}>General Grocery Items</span>
              <span style={{ fontWeight: 800 }}>₹51,500 (28%)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ width: '28%', height: '100%', background: 'var(--gradient-primary)', borderRadius: '9999px' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
