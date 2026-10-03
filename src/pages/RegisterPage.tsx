import React, { useState } from 'react';
import { useToast } from '../context/ToastContext.tsx';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../services/api.ts';
import { ZylixLogo } from '../components/common/ZylixLogo.tsx';
import { Clock, CheckCircle2 } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'Retail Shop',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const businessTypes = [
    'Retail Shop',
    'Grocery Store',
    'Bakery',
    'Café',
    'Fashion Store',
    'General Store',
    'Hardware Store',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setSubmitted(true);
        showToast(res.message || 'Request has been sent to ZYLIX team!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          padding: '1.5rem',
        }}
      >
        <div
          className="zylix-card"
          style={{
            width: '100%',
            maxWidth: '480px',
            textAlign: 'center',
            padding: '2.5rem 2rem',
            backgroundColor: '#FFFFFF',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <ZylixLogo size={48} />
          </div>

          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 122, 0.1)',
              color: 'var(--color-pink)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '1rem 0',
            }}
          >
            <Clock size={36} />
          </div>

          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Registration Request Received
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              marginBottom: '1.5rem',
              fontWeight: 500,
            }}
          >
            Request has been sent to ZYLIX team. We will contact you soon!
          </p>

          <div
            style={{
              background: 'var(--bg-app)',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}
          >
            <div><strong>Business:</strong> {formData.businessName} ({formData.businessType})</div>
            <div><strong>Owner Name:</strong> {formData.ownerName}</div>
            <div><strong>Email:</strong> {formData.email}</div>
            <div><strong>Phone:</strong> {formData.phone}</div>
            <div><strong>City:</strong> {formData.city}</div>
          </div>

          <button onClick={() => navigate('/login')} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

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
      {/* Abstract Gradient Background Blob */}
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
          left: '-100px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '520px', zIndex: 10 }}>
        
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <ZylixLogo size={48} />
        </div>

        {/* Form Card */}
        <div className="zylix-card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
            Register New Business Tenant
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Supermarket"
                  className="form-input"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Type *</label>
                <select
                  className="form-select"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                >
                  {businessTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Owner Name *</label>
              <input
                type="text"
                required
                placeholder="Full Owner Name"
                className="form-input"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Email *</label>
              <input
                type="email"
                required
                placeholder="owner@business.com"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="form-input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+91 9876543210"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mumbai, New York"
                  className="form-input"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Store Address (Optional)</label>
              <input
                type="text"
                placeholder="Street / Area Address"
                className="form-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Submitting Request...' : 'Create Business Account'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--color-pink)', fontWeight: 700 }}>
              Sign In
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

