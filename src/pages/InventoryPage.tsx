import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Product, InventoryTransaction } from '../types/index.ts';
import { KPICard } from '../components/ui/Card.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import {
  Boxes,
  AlertTriangle,
  PackageCheck,
  DollarSign,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isReadOnly = user?.role === 'CASHIER';

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals State
  const [activeModal, setActiveModal] = useState<'stockIn' | 'stockOut' | 'adjust' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionQty, setActionQty] = useState<number>(1);
  const [newStockTarget, setNewStockTarget] = useState<number>(0);
  const [referenceId, setReferenceId] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const [prodRes, txRes, lowRes] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/inventory/transactions'),
        apiFetch('/inventory/low-stock'),
      ]);

      if (prodRes.success) setProducts(prodRes.products || []);
      if (txRes.success) setTransactions(txRes.transactions || []);
      if (lowRes.success) setLowStockItems(lowRes.items || []);
    } catch (err: any) {
      showToast('Failed to load inventory system data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (type: 'stockIn' | 'stockOut' | 'adjust', prod?: Product) => {
    const target = prod || products[0];
    if (!target) {
      showToast('Please add products to your store before managing stock.', 'warning');
      return;
    }
    setSelectedProduct(target);
    setActionQty(1);
    setNewStockTarget(target.current_stock);
    setReferenceId('');
    setActionNotes('');
    setActiveModal(type);
  };

  const handleExecuteStockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);

    try {
      let endpoint = '';
      let body: any = {};

      if (activeModal === 'stockIn') {
        endpoint = '/inventory/stock-in';
        body = { productId: selectedProduct.id, quantity: actionQty, referenceId, notes: actionNotes };
      } else if (activeModal === 'stockOut') {
        endpoint = '/inventory/stock-out';
        body = { productId: selectedProduct.id, quantity: actionQty, referenceId, notes: actionNotes };
      } else if (activeModal === 'adjust') {
        endpoint = '/inventory/adjust';
        body = { productId: selectedProduct.id, newStock: newStockTarget, notes: actionNotes };
      }

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.success) {
        showToast(res.message, 'success');
        setActiveModal(null);
        fetchInventoryData();
      }
    } catch (err: any) {
      showToast(err.message || 'Stock adjustment failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const totalStockValue = products.reduce((acc, p) => acc + p.current_stock * p.selling_price, 0);
  const outOfStockCount = products.filter((p) => p.current_stock <= 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Inventory Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Stock counts, supplier arrivals, and low-stock alerts.
          </p>
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => handleOpenModal('stockIn')} className="btn btn-primary">
              <PlusCircle size={18} /> Add Stock In
            </button>
            <button onClick={() => handleOpenModal('stockOut')} className="btn btn-secondary">
              <MinusCircle size={18} /> Stock Out
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KPICard
          title="Total Products"
          value={products.length}
          subtitle="Items in catalog"
          icon={Boxes}
          iconBg="var(--bg-purple-pastel)"
          iconColor="var(--color-purple)"
        />
        <KPICard
          title="Low Stock Alerts"
          value={lowStockItems.length}
          subtitle="Needs reordering"
          icon={AlertTriangle}
          iconBg="var(--bg-amber-pastel)"
          iconColor="var(--color-warning)"
        />
        <KPICard
          title="Out of Stock"
          value={outOfStockCount}
          subtitle="Zero inventory"
          icon={PackageCheck}
          iconBg="var(--color-danger-bg)"
          iconColor="var(--color-danger)"
        />
        <KPICard
          title="Inventory Value"
          value={formatCurrency(totalStockValue)}
          subtitle="At retail price"
          icon={DollarSign}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
        />
      </div>

      {/* Inventory Table */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading inventory database records...
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="No Inventory Data" description="No products exist in your store tenant catalog." />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Product & SKU</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLowStock = p.current_stock <= p.min_stock && p.current_stock > 0;
                const isOutOfStock = p.current_stock <= 0;

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SKU: {p.sku || 'N/A'}</div>
                    </td>
                    <td>
                      <span className="badge badge-manager">{p.category_name || 'General'}</span>
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {p.current_stock} {p.unit}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {p.min_stock} {p.unit}
                    </td>
                    <td>
                      <span className={`badge ${isOutOfStock ? 'badge-inactive' : isLowStock ? 'badge-warning' : 'badge-active'}`}>
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isReadOnly && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleOpenModal('stockIn', p)}
                            className="btn btn-secondary btn-sm"
                            title="Add Stock In"
                          >
                            + Stock
                          </button>
                          <button
                            onClick={() => handleOpenModal('adjust', p)}
                            className="btn btn-outline btn-sm"
                            title="Adjust Count"
                          >
                            Adjust
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {activeModal && selectedProduct && (
        <Modal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          title={
            activeModal === 'stockIn'
              ? `Stock In: ${selectedProduct.name}`
              : activeModal === 'stockOut'
              ? `Stock Out: ${selectedProduct.name}`
              : `Adjust Inventory Count: ${selectedProduct.name}`
          }
        >
          <form onSubmit={handleExecuteStockAction}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Select Product *</label>
                <select
                  className="form-select"
                  value={selectedProduct.id}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === e.target.value);
                    if (found) {
                      setSelectedProduct(found);
                      setNewStockTarget(found.current_stock);
                    }
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.current_stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {activeModal !== 'adjust' ? (
                <div className="form-group">
                  <label className="form-label">Quantity to {activeModal === 'stockIn' ? 'Add' : 'Deduct'} *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={actionQty}
                    onChange={(e) => setActionQty(parseInt(e.target.value) || 1)}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">New Exact Stock Target *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-input"
                    value={newStockTarget}
                    onChange={(e) => setNewStockTarget(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes / Supplier Ref</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Shipment arrival / Stock audit"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Updating...' : 'Confirm Stock Action'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};
