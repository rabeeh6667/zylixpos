import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  X,
  AlertCircle,
  Building2,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export interface SupplierItem {
  id: string;
  name: string;
  contact_person?: string;
  contact?: string; // fallback alias
  phone?: string;
  email?: string;
  category?: string;
  address?: string;
  status?: string;
  created_at?: string;
}

const DEFAULT_SEED_SUPPLIERS = [
  {
    name: 'Metro Wholesalers Ltd',
    contactPerson: 'Rajesh Kumar',
    phone: '+91 9811223344',
    email: 'orders@metrowholesale.com',
    category: 'General Goods',
    address: 'Warehouse #4, APMC Market Yard, New Delhi',
  },
  {
    name: 'Apex Dairy Supplies',
    contactPerson: 'Sunil Verma',
    phone: '+91 9877665544',
    email: 'dairy@apexdairy.com',
    category: 'Dairy & Beverages',
    address: 'Plot 12, Industrial Area Phase 2, Mumbai',
  },
  {
    name: 'Global Beverage Importers',
    contactPerson: 'Anjali Gupta',
    phone: '+91 9911002299',
    email: 'sales@globalbev.in',
    category: 'Beverages',
    address: 'Commerce Center, Brigade Road, Bengaluru',
  },
];

export const SuppliersPage: React.FC = () => {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    category: 'General Goods',
    address: '',
  });

  // Delete Modal state
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/suppliers');
      const items = res.suppliers || res.items || [];

      if (items.length === 0) {
        // Automatically populate seed suppliers on fresh database
        for (const seed of DEFAULT_SEED_SUPPLIERS) {
          try {
            await apiFetch('/suppliers', {
              method: 'POST',
              body: JSON.stringify(seed),
            });
          } catch (e) {
            // Ignore seed error
          }
        }
        const seededRes = await apiFetch('/suppliers');
        setSuppliers(seededRes.suppliers || seededRes.items || []);
      } else {
        setSuppliers(items);
      }
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
      showToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      category: 'General Goods',
      address: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (s: SupplierItem) => {
    setEditingSupplier(s);
    setForm({
      name: s.name || '',
      contactPerson: s.contact_person || s.contact || '',
      phone: s.phone || '',
      email: s.email || '',
      category: s.category || 'General Goods',
      address: s.address || '',
    });
    setShowModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Supplier name is required', 'warning');
      return;
    }

    try {
      setSaving(true);
      if (editingSupplier) {
        // Update existing
        const res = await apiFetch(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        showToast(res.message || 'Supplier updated successfully!', 'success');
      } else {
        // Create new
        const res = await apiFetch('/suppliers', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        showToast(res.message || 'Supplier added successfully!', 'success');
      }

      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      showToast(err.message || 'Failed to save supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      setDeleting(true);
      const res = await apiFetch(`/suppliers/${supplierToDelete.id}`, {
        method: 'DELETE',
      });
      showToast(res.message || `Supplier '${supplierToDelete.name}' deleted successfully`, 'success');
      setSupplierToDelete(null);
      fetchSuppliers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete supplier', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered list
  const filteredSuppliers = suppliers.filter((s) => {
    const contact = s.contact_person || s.contact || '';
    const matchesSearch =
      search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.toLowerCase().includes(search.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      categoryFilter === '' || (s.category && s.category.toLowerCase() === categoryFilter.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = Array.from(
    new Set(suppliers.map((s) => s.category).filter(Boolean))
  ) as string[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
              <Truck size={22} />
            </div>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Suppliers & Vendors
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.375rem', marginBottom: 0 }}>
            Manage wholesaler contact details, vendor categories, and inventory delivery lines.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={fetchSuppliers} className="btn btn-secondary btn-sm" title="Refresh supplier list">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button onClick={handleOpenAdd} className="btn btn-primary" id="btn-add-supplier">
            <Plus size={18} />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="zylix-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Suppliers
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.375rem' }}>
            {suppliers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={13} /> Active Vendor Network
          </div>
        </div>

        <div className="zylix-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Accounts
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', marginTop: '0.375rem' }}>
            {suppliers.filter((s) => s.status !== 'INACTIVE').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ready for purchase orders
          </div>
        </div>

        <div className="zylix-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Categories Covered
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366F1', marginTop: '0.375rem' }}>
            {uniqueCategories.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Product supply channels
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search suppliers by name, contact, phone, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '180px', fontSize: '0.875rem' }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="zylix-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ marginBottom: '0.75rem' }} />
            <p>Loading suppliers directory...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Building2 size={42} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No Suppliers Found
            </h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              {suppliers.length === 0
                ? 'Your business has no suppliers registered yet.'
                : 'No vendors match your search filters.'}
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd} style={{ margin: '0 auto' }}>
              <Plus size={16} />
              <span>Add First Supplier</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="zylix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Supplier & Company</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Contact Person</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Phone</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Email</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '0.875rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => {
                  const contact = s.contact_person || s.contact || 'N/A';
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                          {s.name}
                        </div>
                        {s.address && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                            <MapPin size={12} />
                            <span>{s.address}</span>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contact}</div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone}`}
                            style={{ color: 'var(--color-purple)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}
                          >
                            <Phone size={13} />
                            <span>{s.phone}</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        {s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                          >
                            <Mail size={13} />
                            <span>{s.email}</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span className="badge badge-manager" style={{ fontWeight: 700 }}>
                          {s.category || 'General Goods'}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Edit Supplier Details"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            onClick={() => setSupplierToDelete(s)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#EF4444' }}
                            title="Delete Supplier"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT SUPPLIER MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="zylix-card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={20} style={{ color: 'var(--color-purple)' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Supplier / Company Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Metro Wholesalers Ltd"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Rajesh Kumar"
                      value={form.contactPerson}
                      onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dairy & Beverages"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="e.g. +91 9811223344"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="orders@supplier.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Warehouse / Office Address</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Plot 12, APMC Market Yard, New Delhi"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? (
                      <>
                        <RefreshCw size={15} className="spin" /> Saving...
                      </>
                    ) : editingSupplier ? (
                      'Update Supplier'
                    ) : (
                      'Save Supplier'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {supplierToDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="zylix-card" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#EF4444' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.375rem 0' }}>
                  Delete Supplier?
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong>{supplierToDelete.name}</strong>?
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              This will remove this supplier from your directory. Existing historical inventory logs referencing this vendor name will remain intact.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                disabled={deleting}
                className="btn btn-danger"
                style={{ backgroundColor: '#EF4444', borderColor: '#EF4444', color: '#FFFFFF', fontWeight: 700 }}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} /> Yes, Delete Supplier
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
