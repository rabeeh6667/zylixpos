import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { KPICard } from '../components/ui/Card.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import {
  DollarSign,
  Plus,
  Search,
  Edit3,
  Archive,
  Receipt,
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<{
    title: string;
    category: string;
    categoryId: string;
    amount: number | string;
    paymentMethod: string;
    expenseDate: string;
    description: string;
  }>({
    title: '',
    category: 'Other',
    categoryId: '',
    amount: '0',
    paymentMethod: 'CASH',
    expenseDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  const defaultCategories = ['Rent', 'Electricity', 'Salary', 'Transport', 'Maintenance', 'Supplies', 'Other'];

  useEffect(() => {
    fetchExpenseCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [searchTerm, selectedCategory, paymentMethodFilter, startDate, endDate]);

  const fetchExpenseCategories = async () => {
    try {
      const res = await apiFetch('/expenses/categories');
      if (res.success) setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load expense categories:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (selectedCategory) queryParams.append('category', selectedCategory);
      if (paymentMethodFilter !== 'ALL') queryParams.append('paymentMethod', paymentMethodFilter);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await apiFetch(`/expenses?${queryParams.toString()}`);
      if (res.success) setExpenses(res.expenses || []);
    } catch (err) {
      showToast('Failed to load expense logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setForm({
      title: '',
      category: 'Rent',
      categoryId: '',
      amount: '0',
      paymentMethod: 'CASH',
      expenseDate: new Date().toISOString().split('T')[0],
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: any) => {
    setEditingExpense(e);
    setForm({
      title: e.title || e.category,
      category: e.category,
      categoryId: e.category_id || '',
      amount: e.amount ?? '0',
      paymentMethod: e.payment_method || 'CASH',
      expenseDate: e.expense_date ? e.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
      description: e.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setSaving(true);
    try {
      const endpoint = editingExpense ? `/expenses/${editingExpense.id}` : '/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const numericAmount = form.amount === '' ? 0 : Number(form.amount);
      const payload = {
        ...form,
        amount: numericAmount,
      };

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast(editingExpense ? 'Expense record updated!' : 'Expense recorded successfully!', 'success');
        setIsModalOpen(false);
        fetchExpenses();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveExpense = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to archive expense '${title}'?`)) return;

    try {
      const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast(`Expense '${title}' archived`, 'success');
        fetchExpenses();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to archive expense', 'error');
    }
  };

  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Expense Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Record operating overheads, utilities, salaries, and shop rent.
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={18} /> Record Expense
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KPICard
          title="Total Filtered Expenses"
          value={formatCurrency(totalExpenseAmount)}
          subtitle={`${expenses.length} records`}
          icon={DollarSign}
          iconBg="var(--color-danger-bg)"
          iconColor="var(--color-danger)"
        />
        <KPICard
          title="Expense Categories"
          value={defaultCategories.length}
          subtitle="Pre-configured classifications"
          icon={Receipt}
          iconBg="var(--bg-amber-pastel)"
          iconColor="var(--color-warning)"
        />
      </div>

      {/* Filters Bar */}
      <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search expenses by title or description..."
            className="form-input"
            style={{ paddingLeft: '38px', height: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: '160px', height: '40px' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {defaultCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ width: '160px', height: '40px' }}
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
        >
          <option value="ALL">All Payment Methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="date"
            className="form-input"
            style={{ width: '140px', height: '40px', fontSize: '0.8125rem' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            className="form-input"
            style={{ width: '140px', height: '40px', fontSize: '0.8125rem' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Expense Table */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading expense records...</div>
        ) : expenses.length === 0 ? (
          <EmptyState title="No Expenses Found" description="Record operating costs to track business net profitability." />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Title / Description</th>
                <th>Category</th>
                <th>Expense Date</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.title || e.category}</div>
                    {e.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{e.description}</div>}
                  </td>
                  <td>
                    <span className="badge badge-cashier">{e.category}</span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                    {new Date(e.expense_date || e.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <span className="badge badge-manager">{e.payment_method || 'CASH'}</span>
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--color-danger)', fontSize: '0.9375rem' }}>
                    {formatCurrency(e.amount)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        onClick={() => handleOpenEdit(e)}
                        className="btn btn-ghost btn-sm"
                        title="Edit Expense"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleArchiveExpense(e.id, e.title || e.category)}
                        className="btn btn-ghost btn-sm"
                        title="Archive Expense"
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

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
      >
        <form onSubmit={handleSaveExpense}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Expense Title *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Shop Electricity Bill"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {defaultCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  className="form-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Expense Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Vendor Notes</label>
              <textarea
                rows={2}
                className="form-textarea"
                placeholder="Bill number or notes..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Expense Record'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
};
