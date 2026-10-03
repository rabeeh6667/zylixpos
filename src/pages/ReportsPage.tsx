import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { KPICard } from '../components/ui/Card.tsx';
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Receipt,
  Download,
  Printer,
  Calendar,
  ChevronDown,
  ShoppingBag,
  CreditCard,
  Package
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'payments'>('sales');

  // Date Filter Presets
  const [datePreset, setDatePreset] = useState<string>('30days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Report Data States
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [productReport, setProductReport] = useState<any | null>(null);
  const [paymentReport, setPaymentReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [datePreset, startDate, endDate, activeTab]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (datePreset !== 'custom') {
        queryParams.append('preset', datePreset);
      } else {
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
      }

      if (activeTab === 'sales') {
        const res = await apiFetch(`/reports/sales?${queryParams.toString()}`);
        if (res.success) setSalesReport(res);
      } else if (activeTab === 'products') {
        const res = await apiFetch(`/reports/products?${queryParams.toString()}`);
        if (res.success) setProductReport(res);
      } else if (activeTab === 'payments') {
        const res = await apiFetch(`/reports/payments?${queryParams.toString()}`);
        if (res.success) setPaymentReport(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const token = localStorage.getItem('zylix_token');
    const query = datePreset !== 'custom' ? `preset=${datePreset}` : `startDate=${startDate}&endDate=${endDate}`;
    const url = `http://localhost:5000/api/reports/export?type=${activeTab}&${query}`;

    // Trigger CSV download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `zylix_${activeTab}_report_${datePreset}.csv`;
        link.click();
        showToast(`Exported ${activeTab.toUpperCase()} report as CSV`, 'success');
      })
      .catch(() => showToast('Failed to export CSV report', 'error'));
  };

  const formatCurrency = (amt: number = 0) => `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Business Reports & Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Database-backed financial reports, category distribution, and payment breakdowns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleExportCsv} className="btn btn-secondary">
            <Download size={18} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={18} /> Print Report
          </button>
        </div>
      </div>

      {/* Date Filter Preset Controls */}
      <div className="zylix-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} style={{ color: 'var(--color-pink)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Filter Date Range:</span>
        </div>

        <select
          className="form-select"
          style={{ width: '180px', height: '40px' }}
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Previous Month</option>
          <option value="custom">Custom Range...</option>
        </select>

        {datePreset === 'custom' && (
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
        )}

        {salesReport?.period && (
          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Period: {salesReport.period.start} to {salesReport.period.end}
          </span>
        )}
      </div>

      {/* Report Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('sales')}
          className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-md)', padding: '0.625rem 1.25rem' }}
        >
          <TrendingUp size={18} /> Sales & Financial Report
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-md)', padding: '0.625rem 1.25rem' }}
        >
          <Package size={18} /> Product & Category Performance
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-md)', padding: '0.625rem 1.25rem' }}
        >
          <CreditCard size={18} /> Payment Methods Distribution
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: 'var(--color-pink)', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
          <span>Generating real-time database aggregations...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* 1. SALES & FINANCIAL REPORT */}
          {activeTab === 'sales' && salesReport?.summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <KPICard
                  title="Total Sales Revenue"
                  value={formatCurrency(salesReport.summary.totalSales)}
                  subtitle={`${salesReport.summary.totalOrders} total orders`}
                  icon={TrendingUp}
                  iconBg="var(--bg-coral-pastel)"
                  iconColor="var(--color-coral)"
                />
                <KPICard
                  title="Items Sold Units"
                  value={salesReport.summary.itemsSold}
                  subtitle="Line item volume"
                  icon={ShoppingBag}
                  iconBg="var(--bg-pink-pastel)"
                  iconColor="var(--color-pink)"
                />
                <KPICard
                  title="Total Operating Expenses"
                  value={formatCurrency(salesReport.summary.totalExpenses)}
                  subtitle="Recorded costs"
                  icon={Receipt}
                  iconBg="var(--color-danger-bg)"
                  iconColor="var(--color-danger)"
                />
                <KPICard
                  title="Estimated Net Profit"
                  value={formatCurrency(salesReport.summary.estimatedProfit)}
                  subtitle={`${salesReport.summary.profitMargin}% net margin`}
                  icon={DollarSign}
                  iconBg="var(--bg-purple-pastel)"
                  iconColor="var(--color-purple)"
                />
              </div>

              {/* Sales Timeline Table */}
              <div className="zylix-card" style={{ backgroundColor: '#FFFFFF' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem' }}>Daily Sales Performance Log</h3>
                <div className="zylix-table-container">
                  <table className="zylix-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Orders Count</th>
                        <th>Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesReport.dailyTimeline || []).map((t: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{t.sale_date}</td>
                          <td>{t.daily_orders} orders</td>
                          <td style={{ fontWeight: 800, color: 'var(--color-pink)' }}>{formatCurrency(t.daily_sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. PRODUCT & CATEGORY REPORT */}
          {activeTab === 'products' && productReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Inventory Valuation Summary */}
              {productReport.stockValuation && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <KPICard
                    title="Retail Inventory Value"
                    value={formatCurrency(productReport.stockValuation.retailValuation)}
                    subtitle={`${productReport.stockValuation.totalStockUnits || 0} total units`}
                    icon={Package}
                    iconBg="var(--bg-purple-pastel)"
                    iconColor="var(--color-purple)"
                  />
                  <KPICard
                    title="Cost Inventory Value"
                    value={formatCurrency(productReport.stockValuation.costValuation)}
                    subtitle="Purchase cost value"
                    icon={DollarSign}
                    iconBg="var(--bg-blue-pastel)"
                    iconColor="var(--color-info)"
                  />
                  <KPICard
                    title="Low Stock Products"
                    value={productReport.stockValuation.lowStockCount || 0}
                    subtitle="Below minimum threshold"
                    icon={BarChart3}
                    iconBg="var(--bg-amber-pastel)"
                    iconColor="var(--color-warning)"
                  />
                </div>
              )}

              {/* Best-Selling Products Table */}
              <div className="zylix-card" style={{ backgroundColor: '#FFFFFF' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem' }}>Top 10 Best-Selling Products</h3>
                <div className="zylix-table-container">
                  <table className="zylix-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>SKU</th>
                        <th>Category</th>
                        <th>Units Sold</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(productReport.bestSellers || []).map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700 }}>{p.name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{p.sku || 'N/A'}</td>
                          <td>
                            <span className="badge badge-manager">{p.category_name || 'General'}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{p.total_units_sold} units</td>
                          <td style={{ fontWeight: 800, color: 'var(--color-pink)' }}>{formatCurrency(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sales By Category */}
              <div className="zylix-card" style={{ backgroundColor: '#FFFFFF' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem' }}>Sales By Category</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(productReport.salesByCategory || []).map((c: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 700 }}>{c.category_name}</span>
                        <span style={{ fontWeight: 800 }}>{formatCurrency(c.total_revenue)} ({c.total_units} units)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(10, (c.total_revenue / (salesReport?.summary?.totalSales || 1)) * 100))}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '9999px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 3. PAYMENT METHOD REPORT */}
          {activeTab === 'payments' && paymentReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="zylix-card" style={{ backgroundColor: '#FFFFFF' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem' }}>Payment Methods Distribution</h3>
                <div className="zylix-table-container">
                  <table className="zylix-table">
                    <thead>
                      <tr>
                        <th>Payment Method</th>
                        <th>Transaction Count</th>
                        <th>Total Amount</th>
                        <th>Share (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentReport.paymentBreakdown || []).map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>
                            <span className="badge badge-manager" style={{ fontSize: '0.8125rem' }}>{p.payment_method}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{p.transaction_count} transactions</td>
                          <td style={{ fontWeight: 800, color: 'var(--color-pink)' }}>{formatCurrency(p.total_amount)}</td>
                          <td style={{ fontWeight: 700 }}>{p.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
