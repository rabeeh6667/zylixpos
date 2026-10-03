import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Save, Building2, Receipt, Sliders, HardDrive, Database, RefreshCw, Plus, Trash2, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';

interface BackupItem {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
  databaseVersion: string;
}

interface DatabaseHealth {
  databaseConnected: boolean;
  foreignKeysEnabled: boolean;
  foreignKeyViolations: number;
  integrityCheck: string;
  schemaStatus: string;
  databaseSizeBytes: number;
  databaseVersion: string;
}

export const SettingsPage: React.FC = () => {
  const { user, business, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'receipt' | 'policy' | 'backup'>('business');

  // Backup State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreModalFile, setRestoreModalFile] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [restoring, setRestoring] = useState(false);

  const [businessForm, setBusinessForm] = useState({
    name: business?.name || '',
    businessType: business?.businessType || 'Retail Shop',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
  });

  const [settingsForm, setSettingsForm] = useState({
    currency: 'INR',
    currency_symbol: '₹',
    tax_rate: '18',
    receipt_header: 'Thank you for shopping at ZYLIX POS!',
    receipt_footer: 'Returns accepted within 14 days with original receipt.',
    low_stock_threshold: '5',
    allow_negative_inventory: 'false',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackupData();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/settings');
      if (res.success && res.settings) {
        setSettingsForm((prev) => ({ ...prev, ...res.settings }));
      }
    } catch (err: any) {
      showToast('Failed to load business settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupData = async () => {
    try {
      const [healthRes, backupRes] = await Promise.all([
        apiFetch('/system/database-health'),
        apiFetch('/system/backups'),
      ]);

      if (healthRes.success) {
        setHealth(healthRes.health);
      }
      if (backupRes.success) {
        setBackups(backupRes.backups || []);
      }
    } catch (err: any) {
      showToast('Failed to fetch backup & database diagnostics', 'error');
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await apiFetch('/system/backup', { method: 'POST' });
      if (res.success) {
        showToast(`Backup created: ${res.backup.filename}`, 'success');
        fetchBackupData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create database backup', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete backup file '${filename}'?`)) {
      return;
    }
    try {
      const res = await apiFetch(`/system/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.success) {
        showToast(`Backup '${filename}' deleted`, 'success');
        fetchBackupData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete backup file', 'error');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalFile) return;
    if (confirmInput.toUpperCase() !== 'RESTORE') {
      showToast('Please type RESTORE to confirm data restoration', 'error');
      return;
    }

    setRestoring(true);
    try {
      const res = await apiFetch('/system/restore', {
        method: 'POST',
        body: JSON.stringify({ filename: restoreModalFile, confirmRestore: true }),
      });

      if (res.success) {
        showToast(res.message || 'Database restored successfully!', 'success');
        setRestoreModalFile(null);
        setConfirmInput('');
        fetchBackupData();
      }
    } catch (err: any) {
      showToast(err.message || 'Restore failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/business', {
        method: 'PUT',
        body: JSON.stringify(businessForm),
      });

      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });

      showToast('Business & Store settings updated!', 'success');
      await refreshProfile();
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Store Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Configure store metadata, receipt templates, inventory policies, and database safety.
          </p>
        </div>
      </div>

      {/* Split Navigation + Form Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Sub Nav */}
        <div className="zylix-card" style={{ padding: '0.75rem', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('business')}
              className={`btn ${activeTab === 'business' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)' }}
            >
              <Building2 size={18} /> Business Profile
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`btn ${activeTab === 'receipt' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)' }}
            >
              <Receipt size={18} /> Invoice & Receipt
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`btn ${activeTab === 'policy' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)' }}
            >
              <Sliders size={18} /> Store Policies
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`btn ${activeTab === 'backup' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ justifyContent: 'flex-start', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)' }}
            >
              <HardDrive size={18} /> Data & Backup
            </button>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="zylix-card" style={{ backgroundColor: '#FFFFFF', padding: '1.75rem' }}>
          {activeTab !== 'backup' ? (
            <form onSubmit={handleSaveAll}>
              {activeTab === 'business' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    Business Identity & Contact
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Business Name *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={businessForm.name}
                      onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select
                      className="form-select"
                      value={businessForm.businessType}
                      onChange={(e) => setBusinessForm({ ...businessForm, businessType: e.target.value })}
                    >
                      <option value="Retail Shop">Retail Shop</option>
                      <option value="Grocery Store">Grocery Store</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Café">Café</option>
                      <option value="General Store">General Store</option>
                      <option value="Hardware Store">Hardware Store</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={businessForm.phone}
                        onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={businessForm.email}
                        onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Store Address</label>
                    <textarea
                      rows={2}
                      className="form-textarea"
                      value={businessForm.address}
                      onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'receipt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    Invoice & Printable Receipt Configuration
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Receipt Header Message</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.receipt_header}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_header: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Receipt Footer Note</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.receipt_footer}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_footer: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'policy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    Inventory & Checkout Controls
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Allow Negative Inventory Checkout</label>
                    <select
                      className="form-select"
                      value={settingsForm.allow_negative_inventory}
                      onChange={(e) => setSettingsForm({ ...settingsForm, allow_negative_inventory: e.target.value })}
                    >
                      <option value="false">Strict Guard (Prevent checkout if stock &lt; quantity)</option>
                      <option value="true">Allow Negative Stock (Permit overselling)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
                  <Save size={18} /> {saving ? 'Saving Settings...' : 'Save All Settings'}
                </button>
              </div>
            </form>
          ) : (
            /* Data & Backup Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Database Safety & Automated Backups
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Create server-side database snapshots and perform safe SQLite online restoration.
                  </p>
                </div>

                {user?.role === 'OWNER' && (
                  <button
                    onClick={handleCreateBackup}
                    disabled={creatingBackup}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {creatingBackup ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                    <span>{creatingBackup ? 'Creating Snapshot...' : 'Create Backup'}</span>
                  </button>
                )}
              </div>

              {/* Database Health Card */}
              {health && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '4px' }}>
                      <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {health.databaseConnected ? 'Healthy (Connected)' : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Integrity Check</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
                        {health.integrityCheck}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Foreign Keys</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {health.foreignKeysEnabled ? 'Enforced (0 Violations)' : 'Disabled'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Database Size</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {formatFileSize(health.databaseSizeBytes)}
                    </div>
                  </div>
                </div>
              )}

              {/* Backup History Table */}
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Backup Snapshot History ({backups.length})
                </h4>

                {backups.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <Database size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>No backups created yet</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Click "Create Backup" above to generate a safe point-in-time database snapshot.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Backup Filename</th>
                          <th>Created Date</th>
                          <th>File Size</th>
                          <th>Version</th>
                          {user?.role === 'OWNER' && <th style={{ textAlign: 'right' }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map((b) => (
                          <tr key={b.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {b.filename}
                            </td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                              {new Date(b.createdAt).toLocaleString()}
                            </td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                              {formatFileSize(b.size)}
                            </td>
                            <td>
                              <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>v{b.databaseVersion}</span>
                            </td>
                            {user?.role === 'OWNER' && (
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                  <button
                                    onClick={() => setRestoreModalFile(b.filename)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ height: '30px', padding: '0 8px', gap: '4px', fontSize: '0.75rem' }}
                                    title="Restore database from this backup"
                                  >
                                    <RotateCcw size={13} />
                                    <span>Restore</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBackup(b.filename)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ height: '30px', padding: '0 6px', color: 'var(--color-danger)' }}
                                    title="Delete backup snapshot"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Restore Confirmation Modal */}
      {restoreModalFile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <div className="zylix-card" style={{ width: '440px', backgroundColor: '#FFFFFF', padding: '1.5rem', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--color-danger)', marginBottom: '0.75rem' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Confirm Database Restoration</h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1rem' }}>
              You are about to restore the database from snapshot <strong style={{ fontFamily: 'monospace' }}>{restoreModalFile}</strong>.
              A safety snapshot of the active database will be created automatically before restoring.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                Type RESTORE to confirm:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="RESTORE"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => { setRestoreModalFile(null); setConfirmInput(''); }}
                className="btn btn-secondary btn-sm"
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="btn btn-danger btn-sm"
                disabled={restoring || confirmInput.toUpperCase() !== 'RESTORE'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                {restoring ? <RefreshCw size={14} className="spin" /> : <RotateCcw size={14} />}
                <span>{restoring ? 'Restoring Database...' : 'Confirm & Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
