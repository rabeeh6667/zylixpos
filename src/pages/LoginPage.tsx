import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { ZylixLogo } from '../components/common/ZylixLogo.tsx';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showToast('Welcome to ZYLIX POS!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Abstract Decorative Background Blob */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'var(--gradient-primary)',
          opacity: 0.07,
          filter: 'blur(80px)',
          top: '-100px',
          right: '-100px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '440px', zIndex: 10 }}>
        
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <ZylixLogo size={52} />
        </div>

        {/* Login Form Card */}
        <div className="zylix-card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            Sign In to Business Portal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
            Enter your email and password to access your store POS.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  placeholder="name@business.com"
                  className="form-input"
                  style={{ paddingLeft: '38px', height: '42px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="form-input"
                  style={{ paddingLeft: '38px', height: '42px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Don't have a business registered?{' '}
            <Link to="/register" style={{ color: 'var(--color-pink)', fontWeight: 700 }}>
              Register Business
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
