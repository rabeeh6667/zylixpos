import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Sale, ReceiptData } from '../types/index.ts';
import { Modal } from '../components/ui/Modal.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { StatusBadge } from '../components/ui/Badge.tsx';
import {
  Receipt,
  Search,
  Printer,
  Eye,
} from 'lucide-react';

export const SalesPage: React.FC = () => {
  const { showToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    fetchSalesHistory();
  }, [searchTerm, paymentMethod, startDate, endDate]);

  const fetchSalesHistory = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (paymentMethod !== 'ALL') queryParams.append('paymentMethod', paymentMethod);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await apiFetch(`/sales?${queryParams.toString()}`);
      if (res.success) setSales(res.sales || []);
    } catch (err: any) {
      showToast('Failed to load sales transaction ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = async (saleId: string) => {
    try {
      const res = await apiFetch(`/pos/receipt/${saleId}`);
      if (res.success) {
        setReceiptData(res.receipt);
        setIsReceiptModalOpen(true);
      }
    } catch (err: any) {
      showToast('Failed to load invoice receipt data', 'error');
    }
  };

  const formatCurrency = (val: number = 0) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Sales Transaction History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Complete audit ledger of customer invoices and completed POS orders.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Invoice #, Customer, or Cashier..."
            className="form-input"
            style={{ paddingLeft: '38px', height: '40px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: '160px', height: '40px' }}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="ALL">All Payments</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">UPI / QR</option>
          <option value="SPLIT">Split Pay</option>
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

      {/* Sales Table */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading sales transaction ledger...
          </div>
        ) : sales.length === 0 ? (
          <EmptyState title="No Sales Transactions" description="Completed customer billing orders will automatically appear here." />
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th>Payment Method</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 800, color: 'var(--color-pink)' }}>#{s.invoice_number}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.customer_name || 'Walk-in Guest'}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.cashier_name || 'Staff'}</div>
                  </td>
                  <td>
                    <span className="badge badge-manager">{s.payment_method}</span>
                  </td>
                  <td style={{ fontWeight: 800, fontSize: '0.9375rem' }}>
                    {formatCurrency(s.grand_total)}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleViewReceipt(s.id)}
                      className="btn btn-ghost btn-sm"
                      title="View & Print Invoice Receipt"
                    >
                      <Eye size={16} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice Receipt Modal */}
      {receiptData && (
        <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} title="Sale Invoice Receipt">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                fontSize: '0.8125rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{receiptData.business.name}</h2>
                <p style={{ color: 'var(--text-secondary)' }}>{receiptData.business.address || 'Retail Store'}</p>
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
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
