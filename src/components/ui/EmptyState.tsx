import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon = Inbox, actionText, onAction }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        background: 'rgba(31, 41, 55, 0.4)',
        border: '1px dashed var(--border-color)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
        <Icon size={32} />
      </div>

      <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f9fafb', marginBottom: '0.375rem' }}>{title}</h4>
      <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '400px', marginBottom: actionText ? '1.25rem' : 0 }}>{description}</p>

      {actionText && onAction && (
        <button onClick={onAction} className="btn btn-primary btn-sm">
          {actionText}
        </button>
      )}
    </div>
  );
};
