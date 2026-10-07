import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Product, Category, InventoryTransaction } from '../types/index.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { StatusBadge } from '../components/ui/Badge.tsx';
import {
  Package,
  Plus,
  Search,
  FolderPlus,
  Barcode,
  Edit3,
  Archive,
  History,
  AlertTriangle,
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isReadOnly = user?.role === 'CASHIER';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<{ product: Product; history: InventoryTransaction[] } | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Form State for Product
  const [productForm, setProductForm] = useState<{
    name: string;
    brand: string;
    sku: string;
    barcode: string;
    categoryId: string;
    purchasePrice: number | string;
    sellingPrice: number | string;
    taxPercentage: number | string;
    currentStock: number | string;
    minimumStock: number | string;
    unit: string;
    description: string;
  }>({
    name: '',
    brand: '',
    sku: '',
    barcode: '',
    categoryId: '',
    purchasePrice: '0',
    sellingPrice: '0',
    taxPercentage: '0',
    currentStock: '0',
    minimumStock: '5',
    unit: 'pcs',
    description: '',
  });

  // Form State for Category
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, selectedCategory, stockStatus, sortBy, sortOrder]);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      if (res.success) setCategories(res.categories || []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (selectedCategory) queryParams.append('categoryId', selectedCategory);
      if (stockStatus !== 'all') queryParams.append('stockStatus', stockStatus);
      queryParams.append('sortBy', sortBy);
      queryParams.append('sortOrder', sortOrder);

      const res = await apiFetch(`/products?${queryParams.toString()}`);
      if (res.success) setProducts(res.products || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load products catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      brand: '',
      sku: '',
      barcode: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      purchasePrice: '0',
      sellingPrice: '0',
      taxPercentage: '0',
      currentStock: '0',
      minimumStock: '5',
      unit: 'pcs',
      description: '',
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      brand: prod.brand || '',
      sku: prod.sku || '',
      barcode: prod.barcode || '',
      categoryId: prod.category_id || '',
      purchasePrice: prod.purchase_price ?? '0',
      sellingPrice: prod.selling_price ?? '0',
      taxPercentage: prod.tax_percentage ?? '0',
      currentStock: prod.current_stock ?? '0',
      minimumStock: prod.min_stock ?? '5',
      unit: prod.unit || 'pcs',
      description: prod.description || '',
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);

    try {
      const endpoint = editingProduct ? `/products/${editingProduct.id}` : '/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const payload = {
        ...productForm,
        purchasePrice: productForm.purchasePrice === '' ? 0 : Number(productForm.purchasePrice),
        sellingPrice: productForm.sellingPrice === '' ? 0 : Number(productForm.sellingPrice),
        taxPercentage: productForm.taxPercentage === '' ? 0 : Number(productForm.taxPercentage),
        currentStock: productForm.currentStock === '' ? 0 : Number(productForm.currentStock),
        minimumStock: productForm.minimumStock === '' ? 5 : Number(productForm.minimumStock),
      };

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast(res.message, 'success');
        setIsProductModalOpen(false);
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleArchiveProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive '${name}'?`)) return;

    try {
      const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast(`Archived '${name}'`, 'success');
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to archive product', 'error');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCategory(true);

    try {
      const res = await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });

      if (res.success) {
        showToast('Category created successfully!', 'success');
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', description: '' });
        fetchCategories();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create category', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleViewProductDetail = async (prod: Product) => {
    try {
      const res = await apiFetch(`/products/${prod.id}`);
      if (res.success) {
        setSelectedProductDetail({ product: res.product, history: res.inventoryHistory || [] });
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch product details', 'error');
    }
  };

  const formatCurrency = (amount: number = 0) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Products Catalog
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage your products, categories, selling prices, and SKUs.
          </p>
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setIsCategoryModalOpen(true)} className="btn btn-secondary">
              <FolderPlus size={18} /> New Category
            </button>
            <button onClick={handleOpenAddProduct} className="btn btn-primary">
              <Plus size={18} /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div
        className="zylix-card"
        style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', backgroundColor: '#FFFFFF' }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by product name, SKU, or barcode..."
            className="form-input"
            style={{ paddingLeft: '38px', height: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: '180px', height: '40px' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ width: '160px', height: '40px' }}
          value={stockStatus}
          onChange={(e) => setStockStatus(e.target.value)}
        >
          <option value="all">All Stock Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock Alerts</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="archived">Archived Products</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: 'var(--color-pink)', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
            <span>Loading product inventory...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Products Found"
            description={searchTerm ? "No products matched your search filter." : "Start building your inventory catalog by adding products."}
            actionText={!isReadOnly ? "Add First Product" : undefined}
            onAction={!isReadOnly ? handleOpenAddProduct : undefined}
          />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Product Name & Brand</th>
                <th>SKU / Barcode</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Stock Level</th>
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
                      {p.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.brand}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--color-pink)', fontWeight: 600 }}>
                        {p.sku || 'No SKU'}
                      </div>
                      {p.barcode && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>
                          <Barcode size={12} /> {p.barcode}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-manager">
                        {p.category_name || 'Uncategorized'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {formatCurrency(p.selling_price)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          className={`badge ${isOutOfStock ? 'badge-inactive' : isLowStock ? 'badge-warning' : 'badge-active'}`}
                          style={{ fontSize: '0.8125rem' }}
                        >
                          {p.current_stock} {p.unit}
                        </span>
                        {isLowStock && <span title="Low Stock Warning"><AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} /></span>}
                        {isOutOfStock && <span title="Out of Stock Warning"><AlertTriangle size={15} style={{ color: 'var(--color-danger)' }} /></span>}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                        <button
                          onClick={() => handleViewProductDetail(p)}
                          className="btn btn-ghost btn-sm"
                          title="View History & Details"
                        >
                          <History size={16} />
                        </button>

                        {!isReadOnly && p.status !== 'ARCHIVED' && (
                          <>
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="btn btn-ghost btn-sm"
                              title="Edit Product"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleArchiveProduct(p.id, p.name)}
                              className="btn btn-ghost btn-sm"
                              title="Archive Product"
                              style={{ color: 'var(--color-danger)' }}
                            >
                              <Archive size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
      >
        <form onSubmit={handleSaveProduct}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Club Sandwich"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price (₹) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  className="form-input"
                  value={productForm.sellingPrice}
                  onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">SKU</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SKU-1001"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Barcode</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 890123456789"
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Initial Stock</label>
                <input
                  type="number"
                  disabled={!!editingProduct}
                  className="form-input"
                  value={productForm.currentStock}
                  onChange={(e) => setProductForm({ ...productForm, currentStock: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Threshold</label>
                <input
                  type="number"
                  className="form-input"
                  value={productForm.minimumStock}
                  onChange={(e) => setProductForm({ ...productForm, minimumStock: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={savingProduct} className="btn btn-primary">
                {savingProduct ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* New Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Create Category">
        <form onSubmit={handleSaveCategory}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Beverages"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={savingCategory} className="btn btn-primary">
                {savingCategory ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
};
