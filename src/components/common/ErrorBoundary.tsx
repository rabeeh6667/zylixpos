import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught a runtime rendering error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="zylix-card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            maxWidth: '520px',
            margin: '3rem auto',
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-coral-pastel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <AlertCircle size={28} style={{ color: 'var(--color-coral)' }} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {this.props.fallbackTitle || 'Something went wrong loading the dashboard.'}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={this.handleReset}
            style={{ margin: '0 auto', gap: '0.5rem' }}
          >
            <RotateCcw size={16} />
            <span>Retry Loading</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
