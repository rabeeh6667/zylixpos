import React from 'react';

interface RoleBadgeProps {
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  let badgeClass = 'badge-active';
  if (role === 'OWNER') badgeClass = 'badge-owner';
  if (role === 'MANAGER') badgeClass = 'badge-manager';
  if (role === 'CASHIER') badgeClass = 'badge-cashier';

  return <span className={`badge ${badgeClass}`}>{role}</span>;
};

interface StatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const isOk = status === 'ACTIVE' || status === 'COMPLETED';
  return <span className={`badge ${isOk ? 'badge-active' : 'badge-inactive'}`}>{status}</span>;
};
