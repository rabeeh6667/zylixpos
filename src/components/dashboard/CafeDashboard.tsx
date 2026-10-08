import React from 'react';
import { Link } from 'react-router-dom';
import { KPICard } from '../ui/Card.tsx';
import {
  Coffee,
  UtensilsCrossed,
  TrendingUp,
  DollarSign,
  Package,
  Receipt,
  Users,
  CreditCard,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface CafeDashboardProps {
  data: any;
  periodLabel: string;
}

export const CafeDashboard: React.FC<CafeDashboardProps> = ({ data, periodLabel }) => {
  const stats = data?.stats || {
    totalSales: 0,
    totalOrders: 0,
    newCustomers: 0,
    totalCustomers: 0,
    netProfit: 0,
    lowStockCount: 0,
    totalProducts: 0,
    comparisons: {}
  };

  const totalSales = Number(stats.totalSales || 0);
  const totalOrders = Number(stats.totalOrders || 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const topProducts: any[] = Array.isArray(data?.charts?.topProducts) ? data.charts.topProducts : [];
  const paymentMethods: any[] = Array.isArray(data?.charts?.paymentMethods) ? data.charts.paymentMethods : [];
  const recentSales: any[] = Array.isArray(data?.recentSales) ? data.recentSales : [];

  const formatCurrency = (amt: number = 0) => {
    return `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const renderTrend = (growthVal: number | null | undefined) => {
    if (growthVal === undefined || growthVal === null) {
      return { value: 'No previous data', isPositive: true, isNeutral: true };
    }
    const isPos = growthVal >= 0;
    return { value: `${isPos ? '+' : ''}${growthVal}%`, isPositive: isPos, isNeutral: false };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Four Café KPI Cards Grid */}
      <div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <KPICard
          title="Today's Sales"
          value={formatCurrency(totalSales)}
          subtitle={stats.comparisons?.salesGrowth !== null && stats.comparisons?.salesGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={Coffee}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
          trend={renderTrend(stats.comparisons?.salesGrowth)}
        />
        <KPICard
          title="Total Orders"
          value={totalOrders}
          subtitle={stats.comparisons?.ordersGrowth !== null && stats.comparisons?.ordersGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={UtensilsCrossed}
          iconBg="var(--bg-pink-pastel)"
          iconColor="var(--color-pink)"
          trend={renderTrend(stats.comparisons?.ordersGrowth)}
        />
        <KPICard
          title="Average Order Value"
          value={formatCurrency(avgOrderValue)}
          subtitle="Average ticket size"
          icon={TrendingUp}
          iconBg="var(--bg-purple-pastel)"
          iconColor="var(--color-purple)"
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(stats.netProfit || 0)}
          subtitle={stats.comparisons?.profitGrowth !== null && stats.comparisons?.profitGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={DollarSign}
          iconBg="var(--bg-blue-pastel)"
          iconColor="var(--color-info)"
          trend={renderTrend(stats.comparisons?.profitGrowth)}
        />
      </div>

      {/* 2. Quick Action Banner Cards */}
      <div className="mobile-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <Link
          to="/pos"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #FF7A59 0%, #F43F7A 100%)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.25rem',
            color: '#FFFFFF',
            boxShadow: '0 8px 20px rgba(244, 63, 122, 0.3)',
            textDecoration: 'none',
            transition: 'transform 0.2s ease, boxShadow 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coffee size={22} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: '1.2', color: '#FFFFFF' }}>New Café Order</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.125rem' }}>Start POS billing</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: '#FFFFFF' }} />
        </Link>

        <Link
          to="/inventory"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.25rem',
            color: '#FFFFFF',
            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.3)',
            textDecoration: 'none',
            transition: 'transform 0.2s ease, boxShadow 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: '1.2', color: '#FFFFFF' }}>Check Inventory</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.125rem' }}>Manage café stock</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: '#FFFFFF' }} />
        </Link>
      </div>

      {/* 3. Best Sellers & Payment Breakdown Row */}
      <div className="dashboard-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Best Sellers Card */}
        <div className="zylix-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-coral-pastel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coffee size={16} style={{ color: 'var(--color-coral)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>☕ Best Sellers</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Top items sold for {periodLabel}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {topProducts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <Coffee size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No café sales recorded yet</div>
                <p style={{ fontSize: '0.75rem' }}>Start your first order from the POS terminal.</p>
              </div>
            ) : (
              topProducts.map((p, idx) => {
                const maxSold = Math.max(...topProducts.map((t: any) => t.sold || 1), 1);
                const progressPct = Math.min(100, Math.round(((p.sold || 0) / maxSold) * 100));

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-muted)', width: '16px' }}>{idx + 1}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>• {p.sold} sold</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.revenue)}</span>
                    </div>

                    <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background: 'var(--gradient-primary)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Payment Breakdown Card */}
        <div className="zylix-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-purple-pastel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={16} style={{ color: 'var(--color-purple)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Payment Breakdown</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Transaction distribution for {periodLabel}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {paymentMethods.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <CreditCard size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No payment statistics</div>
                <p style={{ fontSize: '0.75rem' }}>Completed customer payments will appear here.</p>
              </div>
            ) : (
              paymentMethods.map((pm: any, idx: number) => {
                const methodLabel = pm.payment_method || pm.paymentMethod || 'CASH';
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="badge badge-primary" style={{ fontWeight: 800, padding: '4px 8px' }}>
                        {methodLabel}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {pm.count || 0} transaction{(pm.count || 0) === 1 ? '' : 's'}
                      </span>
                    </div>

                    <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(pm.total || 0)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 4. Recent Orders & Inventory/Customer Summary Row */}
      <div className="dashboard-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Recent Orders List */}
        <div className="zylix-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Recent Orders</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Latest completed café transactions</p>
            </div>
            <Link to="/sales" className="btn btn-ghost btn-sm" style={{ fontWeight: 700, color: 'var(--color-pink)' }}>
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {recentSales.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <Receipt size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No orders placed yet</div>
                <p style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Start your first order from the POS terminal.</p>
                <Link to="/pos" className="btn btn-primary btn-sm" style={{ display: 'inline-flex' }}>
                  <span>Start New Order</span>
                </Link>
              </div>
            ) : (
              recentSales.map((s: any, idx: number) => (
                <div
                  key={s.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                      <Receipt size={16} style={{ color: 'var(--color-pink)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        #{s.invoice_number || s.invoiceNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {s.customer_name || 'Walk-in Guest'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      {formatCurrency(s.grand_total || s.grandTotal || 0)}
                    </span>
                    <span className={`badge ${s.status === 'PENDING' ? 'badge-warning' : s.status === 'CANCELLED' ? 'badge-inactive' : 'badge-active'}`}>
                      {s.status || 'COMPLETED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inventory Status & Customer Summary Cards Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Inventory Status */}
          <div className="zylix-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} style={{ color: 'var(--color-pink)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Café Inventory Status</h3>
              </div>
              <Link to="/inventory" className="btn btn-ghost btn-sm" style={{ fontWeight: 700, color: 'var(--color-pink)', fontSize: '0.75rem' }}>
                Manage Stock →
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', backgroundColor: stats.lowStockCount > 0 ? 'var(--color-danger-bg)' : 'var(--bg-green-pastel)', borderRadius: 'var(--radius-md)', border: stats.lowStockCount > 0 ? '1px solid #FECDD3' : '1px solid #DCFCE7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <AlertCircle size={20} style={{ color: stats.lowStockCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {stats.lowStockCount > 0 ? `${stats.lowStockCount} items low in stock` : 'Stock levels healthy'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {stats.totalProducts || 0} active menu items in catalog
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Summary */}
          <div className="zylix-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <Users size={18} style={{ color: 'var(--color-purple)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Customer Summary</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>New Customers</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                  {stats.newCustomers || 0}
                </div>
              </div>

              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Customers</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                  {stats.totalCustomers || 0}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
