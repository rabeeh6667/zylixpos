import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { KPICard } from '../components/ui/Card.tsx';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  Boxes,
  BarChart3,
  Calendar as CalendarIcon,
  ChevronDown,
  ArrowRight,
  Receipt,
  RotateCcw,
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import { Link } from 'react-router-dom';

type PresetOption = 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  
  // State for dashboard data
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Selector State
  const [activePreset, setActivePreset] = useState<PresetOption>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDashboardData(activePreset, customStart, customEnd);
  }, [activePreset]);

  // Close date selector dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async (preset: PresetOption, start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);

      let query = `/dashboard/stats?preset=${preset}`;
      if (preset === 'custom' && start && end) {
        query += `&startDate=${start}&endDate=${end}`;
      }

      const res = await apiFetch(query);

      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Unable to load dashboard data.');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to connect to server. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number = 0) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const handleSelectPreset = (preset: PresetOption) => {
    if (preset === 'custom') {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    setDateError(null);
    setActivePreset(preset);
    setDateDropdownOpen(false);
  };

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) {
      setDateError('Please select both start and end dates.');
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      setDateError('Start date cannot be after end date.');
      return;
    }
    setDateError(null);
    setActivePreset('custom');
    setDateDropdownOpen(false);
    fetchDashboardData('custom', customStart, customEnd);
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ width: '44px', height: '44px', border: '3px solid #E2E8F0', borderTopColor: 'var(--color-pink)', borderRadius: '50%', margin: '0 auto 1.25rem', animation: 'spin 0.8s linear infinite' }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Loading Store Analytics Dashboard...</h3>
        <p style={{ fontSize: '0.875rem' }}>Aggregating real database transactions</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="zylix-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px', margin: '3rem auto' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-coral-pastel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <AlertCircle size={24} style={{ color: 'var(--color-coral)' }} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Unable to load dashboard data</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => fetchDashboardData(activePreset, customStart, customEnd)} style={{ margin: '0 auto' }}>
          <RotateCcw size={16} />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  const stats = data?.stats || {
    totalSales: 0,
    totalOrders: 0,
    newCustomers: 0,
    netProfit: 0,
    lowStockCount: 0,
    comparisons: {}
  };

  const periodLabel = data?.periodLabel || 'Today';
  const salesOverTime: { day: string; amount: number }[] = Array.isArray(data?.charts?.salesOverTime) ? data.charts.salesOverTime : [];
  const topProducts: any[] = Array.isArray(data?.charts?.topProducts) ? data.charts.topProducts : [];
  const recentSales: any[] = Array.isArray(data?.recentSales) ? data.recentSales : [];

  // Check if any sales exist in salesOverTime chart defensively
  const maxChartVal = Math.max(...salesOverTime.map(s => Number(s?.amount || 0)), 100);
  const totalChartSales = salesOverTime.reduce((acc, curr) => acc + Number(curr?.amount || 0), 0);

  // Helper for trend badge
  const renderTrend = (growthVal: number | null | undefined) => {
    if (growthVal === undefined || growthVal === null) {
      return { value: 'No previous data', isPositive: true, isNeutral: true };
    }
    const isPos = growthVal >= 0;
    return { value: `${isPos ? '+' : ''}${growthVal}%`, isPositive: isPos, isNeutral: false };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Header Greeting Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
            Good Day, {user?.name ? user.name.split(' ')[0] : 'Rabeeh'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.4 }}>
            Real-time sales & operations performance overview for <strong>{periodLabel}</strong>.
          </p>
        </div>

        {/* Date Selector Row with Primary Dropdown + Quick Action Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }} className="no-scrollbar">
          {/* Main Dropdown Button */}
          <div style={{ position: 'relative', flexShrink: 0 }} ref={dropdownRef}>
            <button
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                padding: '0.625rem 1rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xs)',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <CalendarIcon size={18} style={{ color: 'var(--color-pink)' }} />
              <span>{periodLabel}</span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Date Selector Modal Dropdown */}
            {dateDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  left: 0,
                  width: '300px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                  zIndex: 100,
                  padding: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', padding: '0 0.25rem' }}>
                  Select Period
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_month', label: 'Previous Month' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectPreset(opt.id as PresetOption)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: activePreset === opt.id && !isCustomMode ? '1px solid var(--color-pink)' : '1px solid transparent',
                        backgroundColor: activePreset === opt.id && !isCustomMode ? 'var(--bg-pink-pastel)' : 'var(--bg-subtle)',
                        color: activePreset === opt.id && !isCustomMode ? 'var(--color-pink)' : 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span>{opt.label}</span>
                      {activePreset === opt.id && !isCustomMode && <Check size={14} />}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isCustomMode ? '1px solid var(--color-purple)' : '1px solid var(--border-color)',
                    backgroundColor: isCustomMode ? 'var(--bg-purple-pastel)' : '#FFFFFF',
                    color: isCustomMode ? 'var(--color-purple)' : 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '0.25rem'
                  }}
                >
                  <span>Custom Date Range</span>
                  <ChevronDown size={14} style={{ transform: isCustomMode ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {isCustomMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', marginTop: '0.25rem' }}>
                    {dateError && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                        {dateError}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Start Date</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        style={{ padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>End Date</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        style={{ padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => { setIsCustomMode(false); setDateDropdownOpen(false); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={handleApplyCustomRange}
                      >
                        Apply Range
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Period Filter Pills matching reference screenshot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }} className="filter-scroll">
            <button
              onClick={() => handleSelectPreset('today')}
              style={{
                padding: '0.58rem 1.1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                background: activePreset === 'today' ? 'var(--gradient-primary)' : 'var(--bg-subtle)',
                color: activePreset === 'today' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: activePreset === 'today' ? '0 4px 12px rgba(244, 63, 122, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Today
            </button>
            <button
              onClick={() => handleSelectPreset('7days')}
              style={{
                padding: '0.58rem 1.1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                background: activePreset === '7days' ? 'var(--gradient-primary)' : 'var(--bg-subtle)',
                color: activePreset === '7days' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: activePreset === '7days' ? '0 4px 12px rgba(244, 63, 122, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              This Week
            </button>
            <button
              onClick={() => handleSelectPreset('this_month')}
              style={{
                padding: '0.58rem 1.1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                background: activePreset === 'this_month' ? 'var(--gradient-primary)' : 'var(--bg-subtle)',
                color: activePreset === 'this_month' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: activePreset === 'this_month' ? '0 4px 12px rgba(244, 63, 122, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* 2. Four KPI Cards 2-Column Responsive Mobile Grid */}
      <div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <KPICard
          title="Total Sales"
          value={formatCurrency(stats.totalSales || 0)}
          subtitle={stats.comparisons?.salesGrowth !== null && stats.comparisons?.salesGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={DollarSign}
          iconBg="var(--bg-coral-pastel)"
          iconColor="var(--color-coral)"
          trend={renderTrend(stats.comparisons?.salesGrowth)}
        />
        <KPICard
          title="Total Orders"
          value={stats.totalOrders || 0}
          subtitle={stats.comparisons?.ordersGrowth !== null && stats.comparisons?.ordersGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={ShoppingCart}
          iconBg="var(--bg-pink-pastel)"
          iconColor="var(--color-pink)"
          trend={renderTrend(stats.comparisons?.ordersGrowth)}
        />
        <KPICard
          title="New Customers"
          value={stats.newCustomers || 0}
          subtitle={stats.comparisons?.customersGrowth !== null && stats.comparisons?.customersGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={Users}
          iconBg="var(--bg-purple-pastel)"
          iconColor="var(--color-purple)"
          trend={renderTrend(stats.comparisons?.customersGrowth)}
        />
        <KPICard
          title="Net Estimated Profit"
          value={formatCurrency(stats.netProfit || 0)}
          subtitle={stats.comparisons?.profitGrowth !== null && stats.comparisons?.profitGrowth !== undefined ? 'vs. previous period' : 'No previous data'}
          icon={TrendingUp}
          iconBg="var(--bg-blue-pastel)"
          iconColor="var(--color-info)"
          trend={renderTrend(stats.comparisons?.profitGrowth)}
        />
      </div>

      {/* 3. Sales Overview Section */}
      <div className="zylix-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>Sales Overview</h3>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <span>{periodLabel === 'Today' ? 'Last 7 Days' : periodLabel}</span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Responsive Sales Chart */}
        <div style={{ width: '100%', height: '180px', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 600 160" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F43F7A" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#F43F7A" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Subtle Grid Lines */}
            <line x1="40" y1="20" x2="590" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="40" y1="70" x2="590" y2="70" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="40" y1="120" x2="590" y2="120" stroke="#E2E8F0" strokeWidth="1" />

            {/* Y-Axis Labels */}
            <text x="5" y="24" fill="#94A3B8" fontSize="11" fontWeight="600">₹10K</text>
            <text x="5" y="74" fill="#94A3B8" fontSize="11" fontWeight="600">₹5K</text>
            <text x="5" y="124" fill="#94A3B8" fontSize="11" fontWeight="600">₹0</text>

            {/* Line and Area */}
            {(() => {
              const displayItems = salesOverTime.length > 0 ? salesOverTime : [
                { day: 'Oct 1', amount: 0 },
                { day: 'Oct 2', amount: 0 },
                { day: 'Oct 3', amount: 0 },
                { day: 'Oct 4', amount: 0 },
                { day: 'Oct 5', amount: 0 },
                { day: 'Oct 6', amount: 0 },
                { day: 'Oct 7', amount: 0 },
              ];

              const points = displayItems.map((item, idx) => {
                const x = (idx / Math.max(displayItems.length - 1, 1)) * 530 + 50;
                const y = 120 - (item.amount / maxChartVal) * 100;
                return { x, y, amount: item.amount, day: item.day };
              });

              const pathD = `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ');
              const areaD = `${pathD} L ${points[points.length - 1].x},120 L ${points[0].x},120 Z`;

              return (
                <>
                  <path d={areaD} fill="url(#salesGrad)" />
                  <path d={pathD} fill="none" stroke="#F43F7A" strokeWidth="3" strokeLinecap="round" />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#F43F7A" stroke="#FFFFFF" strokeWidth="2" />
                  ))}
                </>
              );
            })()}
          </svg>

          {/* X-Axis Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '40px', paddingRight: '10px', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {(salesOverTime.length > 0 ? salesOverTime : [
              { day: 'Oct 1' }, { day: 'Oct 2' }, { day: 'Oct 3' }, { day: 'Oct 4' }, { day: 'Oct 5' }, { day: 'Oct 6' }, { day: 'Oct 7' }
            ]).map((d, idx) => (
              <span key={idx}>{d.day}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Quick Action Banner Cards matching reference screenshot */}
      <div className="mobile-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* Start POS Billing */}
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
              <Receipt size={22} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: '1.2', color: '#FFFFFF' }}>Start POS Billing</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.125rem' }}>Create new sale</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: '#FFFFFF' }} />
        </Link>

        {/* Manage Products */}
        <Link
          to="/products"
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
              <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: '1.2', color: '#FFFFFF' }}>Manage Products</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', marginTop: '0.125rem' }}>View and edit</div>
            </div>
          </div>
          <ArrowRight size={20} style={{ color: '#FFFFFF' }} />
        </Link>
      </div>

      {/* 4. Recent Sales & Top Products Row */}
      <div className="dashboard-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Recent Sales List */}
        <div className="zylix-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Recent Sales</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Latest completed customer transactions</p>
            </div>
            <Link to="/sales" className="btn btn-ghost btn-sm" style={{ fontWeight: 700, color: 'var(--color-pink)' }}>
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {recentSales.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <Receipt size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No sales yet</div>
                <p style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Completed customer transactions will appear here.</p>
                <Link to="/pos" className="btn btn-primary btn-sm" style={{ display: 'inline-flex' }}>
                  <span>Start New Sale</span>
                </Link>
              </div>
            ) : (
              recentSales.map((s, idx) => (
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
                      {s.customer_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.customer_name}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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

        {/* Top Products Card */}
        <div className="zylix-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Top Products</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Best sellers by volume for {periodLabel}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {topProducts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
                <Package size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No product sales yet</div>
                <p style={{ fontSize: '0.75rem' }}>Best selling products for this period will appear here.</p>
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

                    {/* ZYLIX Gradient Progress Bar */}
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

      </div>

    </div>
  );
};
