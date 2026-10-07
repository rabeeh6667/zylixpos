import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', style }) => {
  return (
    <div className={`zylix-card ${className}`} style={style}>
      {children}
    </div>
  );
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'var(--bg-coral-pastel)',
  iconColor = 'var(--color-coral)',
  trend,
}) => {
  const showSubtitle = subtitle && (!trend || (subtitle !== 'No previous data' && subtitle !== trend.value));

  return (
    <div className="kpi-card">
      <div className="kpi-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <span className="kpi-card-title" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div
          className="kpi-icon-circle"
          style={{
            backgroundColor: iconBg,
            color: iconColor,
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="kpi-card-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>

      {(trend || showSubtitle) && (
        <div className="kpi-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
          {trend && (
            <span
              style={{
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: trend.isPositive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                color: trend.isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: '0.6875rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {showSubtitle && <span className="kpi-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
