import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiFetch } from '../services/api.ts';
import { User, UserRole } from '../types/index.ts';
import { RoleBadge, StatusBadge } from '../components/ui/Badge.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { UserPlus, UserMinus, Trash2, AlertTriangle } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Employee selection for delete modal
  const [selectedDeleteUserId, setSelectedDeleteUserId] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER' as UserRole,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/users');
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load team users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        showToast('Team user created successfully!', 'success');
        setIsCreateModalOpen(false);
        setFormData({ name: '', email: '', password: '', role: 'CASHIER' });
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userIdTarget?: string) => {
    const targetId = userIdTarget || selectedDeleteUserId;
    if (!targetId) {
      showToast('Please select an employee to delete', 'warning');
      return;
    }

    setDeleting(true);
    try {
      const res = await apiFetch(`/users/${targetId}`, {
        method: 'DELETE',
      });

      if (res.success) {
        showToast(res.message || 'Employee account deleted successfully', 'success');
        setIsDeleteModalOpen(false);
        setSelectedDeleteUserId('');
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete employee account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.success) {
        showToast(`User status changed to ${newStatus}`, 'success');
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status', 'error');
    }
  };

  // Filter out current user from deletable list
  const deletableUsers = users.filter((u) => u.id !== currentUser?.id);
  const selectedUserObject = users.find((u) => u.id === selectedDeleteUserId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Employees & Staff Users
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage staff accounts, assign store roles, and set access permissions.
          </p>
        </div>

        {currentUser?.role === 'OWNER' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
              <UserPlus size={18} /> Add Employee
            </button>
            <button
              onClick={() => {
                if (deletableUsers.length > 0) {
                  setSelectedDeleteUserId(deletableUsers[0].id);
                }
                setIsDeleteModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <UserMinus size={18} /> Delete Employee
            </button>
          </div>
        )}
      </div>

      {/* Users Table Container */}
      <div className="zylix-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading team accounts...
          </div>
        ) : (
          <table className="zylix-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Email Address</th>
                <th>Store Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: 'var(--gradient-primary)',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {(u.createdAt || (u as any).created_at) ? new Date(u.createdAt || (u as any).created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {currentUser?.role === 'OWNER' && u.id !== currentUser.id && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => toggleStatus(u)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: u.status === 'ACTIVE' ? 'var(--color-warning, #f59e0b)' : 'var(--color-success)' }}
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedDeleteUserId(u.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444' }}
                          title="Delete Employee"
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Employee Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add Staff Employee">
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Alice Green"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="e.g. alice@store.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Password *</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Role *</label>
              <select
                className="form-select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              >
                <option value="CASHIER">CASHIER (POS Billing only)</option>
                <option value="MANAGER">MANAGER (Products, Inventory, Sales)</option>
                <option value="OWNER">OWNER (Full Administrative Access)</option>
              </select>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create Employee Account'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Employee Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Employee Account">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '0.25rem' }}>Confirm Deletion</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Deleting an employee account will remove their system access. If they have past transaction records, their profile will be safely deactivated to protect sales history integrity.
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Employee to Delete *</label>
            {deletableUsers.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                No other employee accounts available for deletion.
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedDeleteUserId}
                onChange={(e) => setSelectedDeleteUserId(e.target.value)}
              >
                {deletableUsers.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) — {emp.role}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedUserObject && (
            <div style={{ padding: '0.875rem', borderRadius: '6px', background: 'var(--bg-surface-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', fontSize: '0.85rem' }}>
              <div><strong>Name:</strong> {selectedUserObject.name}</div>
              <div><strong>Email:</strong> {selectedUserObject.email}</div>
              <div><strong>Role:</strong> {selectedUserObject.role}</div>
              <div><strong>Status:</strong> {selectedUserObject.status}</div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting || deletableUsers.length === 0}
              onClick={() => handleDeleteUser()}
              className="btn btn-danger"
              style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
            >
              {deleting ? 'Deleting...' : 'Delete Employee'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

