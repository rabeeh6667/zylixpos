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
  subtitle = 'vs. yesterday',
  icon: Icon,
  iconBg = 'var(--bg-coral-pastel)',
  iconColor = 'var(--color-coral)',
  trend,
}) => {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div
          style={{
            backgroundColor: iconBg,
            color: iconColor,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} />
        </div>
      </div>

      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
        {trend && (
          <span
            style={{
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: trend.isPositive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: trend.isPositive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>{subtitle}</span>
      </div>
    </div>
  );
};
