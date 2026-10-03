import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Product, Category, Customer, CartItem, HeldSale, ReceiptData } from '../types/index.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { NumericInput } from '../components/ui/NumericInput.tsx';
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  UserPlus,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';

export const PosPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
  const [billDiscountMode, setBillDiscountMode] = useState<'percent' | 'amount'>('percent');

  // Modals State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const CART_STORAGE_KEY = 'zylix_active_cart';

  // Checkout & Safety State
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'SPLIT'>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<{ paymentMethod: 'CASH' | 'CARD' | 'UPI'; amount: number }[]>([
    { paymentMethod: 'CASH', amount: 0 },
    { paymentMethod: 'CARD', amount: 0 },
  ]);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Cart Recovery State
  const [savedCartPrompt, setSavedCartPrompt] = useState<any | null>(null);

  // Receipt & Completion State
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptTab, setReceiptTab] = useState<'thermal' | 'a4'>('thermal');

  // Customer Form State
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialPosData();
    checkSavedCart();
  }, []);

  // Check saved cart in localStorage
  const checkSavedCart = () => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          setSavedCartPrompt(parsed);
        }
      }
    } catch (e) {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  };

  const handleRestoreSavedCart = () => {
    if (savedCartPrompt) {
      setCart(savedCartPrompt.cart || []);
      if (savedCartPrompt.selectedCustomerId) setSelectedCustomerId(savedCartPrompt.selectedCustomerId);
      if (savedCartPrompt.orderDiscount) setOrderDiscount(savedCartPrompt.orderDiscount);
      if (savedCartPrompt.idempotencyKey) setIdempotencyKey(savedCartPrompt.idempotencyKey);
      setSavedCartPrompt(null);
      showToast('Restored previous active cart!', 'success');
    }
  };

  const handleDiscardSavedCart = () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    setSavedCartPrompt(null);
    showToast('Previous cart discarded', 'info');
  };

  // Auto-persist cart to localStorage
  useEffect(() => {
    if (cart.length > 0) {
      const payload = {
        cart,
        selectedCustomerId,
        orderDiscount,
        idempotencyKey,
        timestamp: Date.now(),
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cart, selectedCustomerId, orderDiscount, idempotencyKey]);

  const fetchInitialPosData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes, heldRes] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/categories'),
        apiFetch('/customers'),
        apiFetch('/pos/held'),
      ]);

      if (prodRes.success) setProducts((prodRes.products || []).filter((p: Product) => p.status === 'ACTIVE'));
      if (catRes.success) setCategories((catRes.categories || []).filter((c: Category) => c.status === 'ACTIVE'));
      if (custRes.success) setCustomers(custRes.customers || []);
      if (heldRes.success) setHeldSales(heldRes.heldSales || []);
    } catch (err: any) {
      showToast('Failed to initialize POS terminal data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Barcode Scanner Handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    const foundProduct = products.find(
      (p) => p.barcode === query || p.sku === query || p.name.toLowerCase() === query.toLowerCase()
    );

    if (foundProduct) {
      addToCart(foundProduct);
      setBarcodeInput('');
      showToast(`Scanned '${foundProduct.name}' -> Added to Cart`, 'success');
    } else {
      showToast(`No active product found matching barcode '${query}'`, 'error');
    }

    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  // Add Product to Cart
  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      showToast(`Warning: '${product.name}' is currently out of stock.`, 'warning');
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].quantity + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            unitPrice: product.selling_price,
            discount: 0,
            tax: (product.selling_price * (product.tax_percentage || 0)) / 100,
          },
        ];
      }
    });
  };

  // Cart Controls
  const updateCartItemQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId('');
    setOrderDiscount(0);
    setBillDiscountPercent(0);
    setBillDiscountMode('percent');
    setIdempotencyKey('');
    setCheckoutError(null);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  // Calculations
  const cartGrossSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const cartItemDiscounts = cart.reduce((acc, item) => acc + (item.discount || 0) * item.quantity, 0);
  const netSubtotalAfterItemDiscounts = Math.max(0, cartGrossSubtotal - cartItemDiscounts);

  const computedBillDiscount = billDiscountMode === 'percent'
    ? Math.round((netSubtotalAfterItemDiscounts * (billDiscountPercent / 100)) * 100) / 100
    : orderDiscount;

  const clampedBillDiscount = Math.min(netSubtotalAfterItemDiscounts, Math.max(0, computedBillDiscount));
  const subtotalAfterAllDiscounts = Math.max(0, netSubtotalAfterItemDiscounts - clampedBillDiscount);

  const cartTaxes = cart.reduce((acc, item) => acc + (item.tax || 0) * item.quantity, 0);
  const grandTotal = Math.round((subtotalAfterAllDiscounts + cartTaxes) * 100) / 100;
  const cartSubtotal = cartGrossSubtotal;

  // Hold Sale
  const handleHoldSale = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add products before holding sale.', 'warning');
      return;
    }

    try {
      const res = await apiFetch('/pos/hold', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId || null,
          cartJson: JSON.stringify({ cart, orderDiscount, billDiscountPercent, billDiscountMode }),
          note: `Held cart with ${cart.length} item(s)`,
        }),
      });

      if (res.success) {
        showToast('Sale held successfully!', 'success');
        clearCart();
        fetchInitialPosData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to hold sale', 'error');
    }
  };

  // Resume Sale
  const handleResumeSale = async (held: HeldSale) => {
    try {
      let cartItems: CartItem[] = [];
      let discOrder = 0;
      let discPercent = 0;
      let discMode: 'percent' | 'amount' = 'percent';

      let parsed: any = null;
      try {
        parsed = JSON.parse(held.cart_json);
      } catch (e) {
        console.error('Failed to parse cart JSON', e);
      }

      if (Array.isArray(parsed)) {
        cartItems = parsed;
      } else if (parsed && Array.isArray(parsed.cart)) {
        cartItems = parsed.cart;
        discOrder = parsed.orderDiscount || 0;
        discPercent = parsed.billDiscountPercent || 0;
        discMode = parsed.billDiscountMode || 'percent';
      }

      if (cartItems.length > 0) {
        setCart(cartItems);
        setOrderDiscount(discOrder);
        setBillDiscountPercent(discPercent);
        setBillDiscountMode(discMode);
        setSelectedCustomerId(held.customer_id || '');

        await apiFetch(`/pos/held/${held.id}`, { method: 'DELETE' });
        showToast('Held sale resumed to active cart.', 'success');
        setIsHeldModalOpen(false);
        fetchInitialPosData();
      } else {
        showToast('Held sale contains no valid items.', 'warning');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to parse held cart payload', 'error');
    }
  };

  // Discard Held Sale
  const handleDeleteHeldSale = async (heldId: string) => {
    try {
      const res = await apiFetch(`/pos/held/${heldId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Held bill discarded.', 'success');
        fetchInitialPosData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete held bill', 'error');
    }
  };

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add products to start checkout.', 'warning');
      return;
    }

    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
    setCheckoutError(null);
    setAmountReceived(grandTotal);
    setSplitPayments([
      { paymentMethod: 'CASH', amount: Math.round((grandTotal / 2) * 100) / 100 },
      { paymentMethod: 'CARD', amount: Math.round((grandTotal / 2) * 100) / 100 },
    ]);
    setIsCheckoutModalOpen(true);
  };

  // Execute Checkout (Safe Idempotent Retry)
  const handleExecuteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCheckout(true);
    setCheckoutError(null);

    const keyToUse = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) {
      setIdempotencyKey(keyToUse);
    }

    try {
      const payload = {
        customerId: selectedCustomerId || null,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent || 0,
          discount: i.discount || 0,
          tax: i.tax,
        })),
        subtotal: cartGrossSubtotal,
        productDiscountsTotal: cartItemDiscounts,
        billDiscountPercent: billDiscountMode === 'percent' ? billDiscountPercent : 0,
        billDiscountAmount: clampedBillDiscount,
        discount: cartItemDiscounts + clampedBillDiscount,
        tax: cartTaxes,
        grandTotal,
        amountReceived,
        paymentMethod,
        payments: paymentMethod === 'SPLIT' ? splitPayments : undefined,
        idempotencyKey: keyToUse,
        notes: orderNotes,
      };

      const res = await apiFetch('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast(res.message, 'success');
        setIsCheckoutModalOpen(false);

        const receiptRes = await apiFetch(`/pos/receipt/${res.sale.id}`);
        if (receiptRes.success) {
          setReceiptData(receiptRes.receipt);
          setIsReceiptModalOpen(true);
        }

        clearCart();
        fetchInitialPosData();
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unable to complete sale. Your sale has not been recorded.';
      setCheckoutError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  // Quick Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    try {
      const res = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(customerForm),
      });
      if (res.success) {
        showToast('Customer created successfully!', 'success');
        setIsCustomerModalOpen(false);
        setCustomerForm({ name: '', phone: '', email: '', address: '' });
        fetchInitialPosData();
        if (res.customerId) setSelectedCustomerId(res.customerId);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Format Currency
  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = !selectedCategoryId || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="pos-container">
      
      {/* LEFT PANEL: Barcode, Search, Categories & Product Grid */}
      <div className="pos-catalog-panel">
        
        {/* Barcode Scanner Input Card */}
        <div className="zylix-card" style={{ padding: '0.875rem 1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)' }}>
          <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                background: 'var(--gradient-primary)',
                color: '#FFFFFF',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-gradient)',
              }}
            >
              <Barcode size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / SKU (USB or Bluetooth Scanner Ready)..."
                className="form-input"
                style={{ fontSize: '0.9375rem', fontWeight: 600, height: '40px' }}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ height: '40px' }}>
              Scan / Enter
            </button>
          </form>
        </div>

        {/* Product Search & Category Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product catalog by name, SKU, or barcode..."
              className="form-input"
              style={{ paddingLeft: '42px', height: '42px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setSelectedCategoryId('')}
              className={`btn btn-sm ${!selectedCategoryId ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              All Products ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                className={`btn btn-sm ${selectedCategoryId === c.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid Catalog */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading products catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState title="No Matching Products" description="Try adjusting your search terms or category selection." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {filteredProducts.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="zylix-card"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.15s ease',
                      opacity: isOutOfStock ? 0.65 : 1,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: 'var(--color-pink)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {p.category_name || 'Item'}
                      </span>
                      <h4
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                          marginTop: '0.25rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {p.name}
                      </h4>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(p.selling_price)}
                        </span>
                        <span
                          className={`badge ${isOutOfStock ? 'badge-inactive' : 'badge-active'}`}
                          style={{ fontSize: '0.6875rem', padding: '2px 6px' }}
                        >
                          {p.current_stock} {p.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* RIGHT PANEL: Cart & Billing Summary */}
      <div className="pos-cart-panel zylix-card">
        
        {/* Saved Cart Recovery Banner */}
        {savedCartPrompt && (
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--color-pink)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Restore previous cart?
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Unsaved cart with {savedCartPrompt.cart?.length || 0} item(s) found from previous session.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <button
                type="button"
                onClick={handleRestoreSavedCart}
                className="btn btn-primary btn-sm"
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handleDiscardSavedCart}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Customer Selector & Quick Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1 }}>
            <select
              className="form-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{ fontSize: '0.8125rem', height: '38px' }}
            >
              <option value="">Guest Customer (Walk-in)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  👤 {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ height: '38px', padding: '0 0.625rem' }}
            title="Register New Customer"
          >
            <UserPlus size={16} />
          </button>
        </div>

        {/* Cart Item Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={18} style={{ color: 'var(--color-pink)' }} /> Current Cart ({cart.reduce((a, b) => a + b.quantity, 0)})
          </span>
          {cart.length > 0 && (
            <button onClick={clearCart} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: '0.25rem 0.5rem' }}>
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem', paddingRight: '0.25rem' }}>
          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingCart size={42} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Your Cart is Empty</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scan a barcode or select products to start billing</span>
            </div>
          ) : (
            cart.map((item) => {
              const lineGross = item.unitPrice * item.quantity;
              const itemDiscountTotal = (item.discount || 0) * item.quantity;
              const lineSubtotal = Math.max(0, lineGross - itemDiscountTotal);

              return (
                <div
                  key={item.product.id}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatCurrency(item.unitPrice)} / {item.product.unit}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                      {formatCurrency(lineSubtotal)}
                    </div>
                  </div>

                  {/* Quantity & Item Discount Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.125rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Qty:</span>
                      <NumericInput
                        value={item.quantity}
                        onChange={(newQty) => {
                          setCart((prev) => prev.map((i) => (i.product.id === item.product.id ? { ...i, quantity: newQty } : i)));
                        }}
                        min={1}
                        max={item.product.current_stock || 9999}
                        size="sm"
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Disc %:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="0"
                        style={{ width: '55px', padding: '2px 6px', fontSize: '0.75rem', textAlign: 'right', height: '28px' }}
                        className="form-input"
                        value={item.discountPercent !== undefined ? item.discountPercent : ''}
                        onChange={(e) => {
                          const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          const discAmt = (item.unitPrice * pct) / 100;
                          setCart((prev) => prev.map((i) => (i.product.id === item.product.id ? { ...i, discountPercent: pct, discount: discAmt } : i)));
                        }}
                      />

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Disc ₹:</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        style={{ width: '60px', padding: '2px 6px', fontSize: '0.75rem', textAlign: 'right', height: '28px' }}
                        className="form-input"
                        value={item.discount || ''}
                        onChange={(e) => {
                          const amt = Math.max(0, parseFloat(e.target.value) || 0);
                          const pct = item.unitPrice > 0 ? Math.min(100, (amt / item.unitPrice) * 100) : 0;
                          setCart((prev) => prev.map((i) => (i.product.id === item.product.id ? { ...i, discount: amt, discountPercent: Math.round(pct * 100) / 100 } : i)));
                        }}
                      />

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)', padding: '0.25rem' }}
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Totals Breakdown */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Subtotal (Gross)</span>
            <span>{formatCurrency(cartGrossSubtotal)}</span>
          </div>

          {cartItemDiscounts > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
              <span>Product Discounts</span>
              <span>−{formatCurrency(cartItemDiscounts)}</span>
            </div>
          )}

          {cartItemDiscounts > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span>Net Items Subtotal</span>
              <span>{formatCurrency(netSubtotalAfterItemDiscounts)}</span>
            </div>
          )}

          {/* Bill Discount Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span>Bill Discount</span>
              <button
                type="button"
                onClick={() => setBillDiscountMode(billDiscountMode === 'percent' ? 'amount' : 'percent')}
                className="btn btn-ghost btn-sm"
                style={{ padding: '1px 6px', fontSize: '0.6875rem', border: '1px solid var(--border-color)' }}
              >
                {billDiscountMode === 'percent' ? '%' : '₹'}
              </button>
            </div>

            {billDiscountMode === 'percent' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="0"
                  style={{ width: '65px', padding: '2px 8px', fontSize: '0.8125rem', textAlign: 'right', height: '30px' }}
                  className="form-input"
                  value={billDiscountPercent || ''}
                  onChange={(e) => setBillDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  (−{formatCurrency(clampedBillDiscount)})
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  style={{ width: '85px', padding: '2px 8px', fontSize: '0.8125rem', textAlign: 'right', height: '30px' }}
                  className="form-input"
                  value={orderDiscount || ''}
                  onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            )}
          </div>

          {cartTaxes > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Tax Amount</span>
              <span>+{formatCurrency(cartTaxes)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', marginTop: '0.25rem' }}>
            <span>Grand Total</span>
            <span style={{ color: 'var(--color-pink)' }}>{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Bottom Checkout Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={handleHoldSale} disabled={cart.length === 0} className="btn btn-secondary btn-sm" style={{ padding: '0.75rem 0.5rem' }}>
            <Pause size={16} /> Hold
          </button>

          <button onClick={() => setIsHeldModalOpen(true)} className="btn btn-outline btn-sm" style={{ padding: '0.75rem 0.5rem' }}>
            <Play size={16} /> Held ({heldSales.length})
          </button>

          <button onClick={handleOpenCheckout} disabled={cart.length === 0} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Complete Sale
          </button>
        </div>

      </div>

      {/* CHECKOUT MODAL */}
      <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Complete POS Sale Checkout">
        <form onSubmit={handleExecuteCheckout}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Network / Checkout Error State Banner */}
            {checkoutError && (
              <div
                style={{
                  padding: '0.875rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                  <AlertCircle size={18} />
                  <span>Checkout Interrupted</span>
                </div>
                <div>{checkoutError}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Retrying will reuse the exact transaction key ({idempotencyKey.slice(0, 8)}...) to prevent duplicate sales.
                </div>
              </div>
            )}

            {/* Grand Total Highlight */}
            <div
              style={{
                background: 'var(--gradient-primary)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                color: '#FFFFFF',
                boxShadow: 'var(--shadow-gradient)',
              }}
            >
              <span style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                Grand Payable Amount
              </span>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
                {formatCurrency(grandTotal)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="form-group">
              <label className="form-label">Select Payment Method *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flexDirection: 'column', padding: '0.75rem 0.25rem', fontSize: '0.75rem' }}
                >
                  <Banknote size={20} /> Cash
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`btn ${paymentMethod === 'CARD' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flexDirection: 'column', padding: '0.75rem 0.25rem', fontSize: '0.75rem' }}
                >
                  <CreditCard size={20} /> Card
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`btn ${paymentMethod === 'UPI' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flexDirection: 'column', padding: '0.75rem 0.25rem', fontSize: '0.75rem' }}
                >
                  <QrCode size={20} /> UPI / QR
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('SPLIT')}
                  className={`btn ${paymentMethod === 'SPLIT' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flexDirection: 'column', padding: '0.75rem 0.25rem', fontSize: '0.75rem' }}
                >
                  <Layers size={20} /> Split Pay
                </button>
              </div>
            </div>

            {/* Cash Received & Change Due */}
            {paymentMethod === 'CASH' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Amount Received (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    min={grandTotal}
                    required
                    className="form-input"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Change Due (₹)</label>
                  <div
                    className="form-input"
                    style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', fontWeight: 800, fontSize: '1.125rem' }}
                  >
                    {formatCurrency(Math.max(0, amountReceived - grandTotal))}
                  </div>
                </div>
              </div>
            )}

            {/* Split Payment Breakdown */}
            {paymentMethod === 'SPLIT' && (
              <div className="zylix-card" style={{ padding: '1rem', backgroundColor: 'var(--bg-subtle)' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Split Payment Amounts</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cash Amount (₹)</span>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={splitPayments[0].amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSplitPayments([
                          { paymentMethod: 'CASH', amount: val },
                          { paymentMethod: 'CARD', amount: Math.max(0, grandTotal - val) },
                        ]);
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Card Amount (₹)</span>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={splitPayments[1].amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSplitPayments([
                          { paymentMethod: 'CASH', amount: Math.max(0, grandTotal - val) },
                          { paymentMethod: 'CARD', amount: val },
                        ]);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submittingCheckout} className="btn btn-primary">
                {submittingCheckout ? 'Processing...' : checkoutError ? 'Retry Checkout' : 'Confirm & Print Invoice'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* NEW CUSTOMER MODAL */}
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Add New Customer">
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. John Doe"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. +91 9876543210"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={savingCustomer} className="btn btn-primary">
                {savingCustomer ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* RECEIPT / INVOICE PRINT MODAL */}
      {receiptData && (
        <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Sale Receipt & Invoice">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setReceiptTab('thermal')}
                className={`btn btn-sm ${receiptTab === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Thermal (80mm)
              </button>
              <button
                onClick={() => setReceiptTab('a4')}
                className={`btn btn-sm ${receiptTab === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
              >
                A4 Standard Invoice
              </button>
            </div>

            {/* Printable Receipt Box */}
            <div
              id="printable-receipt"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                fontSize: '0.8125rem',
                color: '#0F172A',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{receiptData.business.name}</h2>
                <p style={{ color: 'var(--text-secondary)' }}>{receiptData.business.address || 'ZYLIX Retail Outlet'}</p>
                <p style={{ color: 'var(--text-secondary)' }}>Phone: {receiptData.business.phone || 'N/A'}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', borderBottom: '1px dashed var(--border-color)', padding: '0.5rem 0', margin: '0.75rem 0' }}>
                <span>Invoice: #{receiptData.sale.invoice_number}</span>
                <span>Date: {new Date(receiptData.sale.created_at).toLocaleDateString()}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.75rem 0' }}>
                {receiptData.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {item.product_name} x{item.quantity}
                    </span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                  <span>TOTAL PAID</span>
                  <span>{formatCurrency(receiptData.sale.grand_total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Payment Method</span>
                  <span>{receiptData.sale.payment_method}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => window.print()} className="btn btn-secondary">
                <Printer size={16} /> Print Receipt
              </button>
              <button onClick={() => setIsReceiptModalOpen(false)} className="btn btn-primary">
                New Sale
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* HELD SALES MODAL */}
      <Modal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        title={`Held Sales / Bills (${heldSales.length})`}
      >
        {heldSales.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Held Bills"
            description="There are currently no bills or carts on hold. You can put an active cart on hold using the Hold button."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '450px', overflowY: 'auto' }}>
            {heldSales.map((held) => {
              let items: CartItem[] = [];
              let itemCount = 0;
              let totalAmount = 0;

              try {
                const parsed = JSON.parse(held.cart_json);
                if (Array.isArray(parsed)) {
                  items = parsed;
                } else if (parsed && Array.isArray(parsed.cart)) {
                  items = parsed.cart;
                }
                itemCount = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
                totalAmount = items.reduce((acc, i) => acc + ((i.unitPrice || 0) * (i.quantity || 1)), 0);
              } catch (e) {
                // Ignore parse errors for preview
              }

              return (
                <div
                  key={held.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {held.customer_name ? `Customer: ${held.customer_name}` : 'Walk-in Customer'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Clock size={13} />
                        <span>{new Date(held.created_at).toLocaleString()}</span>
                        {held.cashier_name && <span>• Cashier: {held.cashier_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-pink)' }}>
                        {formatCurrency(totalAmount)}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Items: </span>
                      {items.map((i) => `${i.product?.name || 'Product'} (x${i.quantity})`).join(', ')}
                    </div>
                  )}

                  {held.note && (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      Note: {held.note}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteHeldSale(held.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={15} /> Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResumeSale(held)}
                      className="btn btn-primary btn-sm"
                    >
                      <Play size={15} /> Resume Bill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

    </div>
  );
};
