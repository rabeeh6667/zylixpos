import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { hashPassword } from '../utils/password.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

import { createNotification } from '../utils/notificationLogger.ts';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER']),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: z.string().min(6).optional(),
});

export async function getUsers(req: Request, res: Response) {
  try {
    const users = db.prepare(`
      SELECT id, name, email, role, status, created_at, updated_at
      FROM users
      WHERE business_id = ?
      ORDER BY created_at DESC
    `).all(req.businessId);

    return res.json({
      success: true,
      users,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, email, password, role } = parseResult.data;

    // Check if manager is trying to create an OWNER or MANAGER
    if (req.userRole === 'MANAGER' && (role === 'OWNER' || role === 'MANAGER')) {
      return res.status(403).json({
        success: false,
        message: 'Managers can only create Cashier accounts.',
      });
    }

    // Check if email exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const id = cryptoUUID();
    const passwordHash = await hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(id, req.businessId, name, email.toLowerCase(), passwordHash, role);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'USER_CREATED',
      entity: 'user',
      entityId: id,
      metadata: { name, email, role },
    });

    createNotification({
      businessId: req.businessId!,
      userId: req.user?.userId,
      type: 'USER_ADDED',
      title: 'New Staff Member Added',
      message: `${name} (${role}) was added to your store.`,
      entityType: 'user',
      entityId: id,
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: { id, name, email: email.toLowerCase(), role, status: 'ACTIVE' },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    // Ensure target user belongs to current tenant
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ? AND business_id = ?').get(id, req.businessId) as any;
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found in your business.' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    const data = parseResult.data;
    if (data.name) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.role) {
      if (req.userRole !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Only Business Owners can change user roles.' });
      }
      updates.push('role = ?');
      params.push(data.role);
    }
    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.password) {
      const hash = await hashPassword(data.password);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.businessId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`).run(...params);

    if (data.role) {
      logAuditEvent({
        businessId: req.businessId!,
        userId: req.user?.userId,
        action: 'ROLE_CHANGED',
        entity: 'user',
        entityId: id,
        description: `User role changed to ${data.role}`,
        metadata: { targetUserEmail: targetUser.email, newRole: data.role },
      });
    }

    if (data.password) {
      logAuditEvent({
        businessId: req.businessId!,
        userId: req.user?.userId,
        action: 'PASSWORD_CHANGE',
        entity: 'user',
        entityId: id,
        description: `Password changed for user ${targetUser.email}`,
      });
    }

    if (data.status === 'INACTIVE') {
      logAuditEvent({
        businessId: req.businessId!,
        userId: req.user?.userId,
        action: 'USER_ARCHIVED',
        entity: 'user',
        entityId: id,
        description: `User ${targetUser.email} archived`,
      });
    }

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'USER_UPDATED',
      entity: 'user',
      entityId: id,
      description: `User ${targetUser.name} updated`,
      metadata: { targetUserEmail: targetUser.email, updates: parseResult.data },
    });

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (id === req.user?.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ? AND business_id = ?').get(id, req.businessId) as any;
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let deleted = false;
    try {
      db.prepare('DELETE FROM users WHERE id = ? AND business_id = ?').run(id, req.businessId);
      deleted = true;
    } catch (dbErr) {
      // Fallback to soft deletion/deactivation if user is referenced in sales or audit logs
      db.prepare(`UPDATE users SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?`).run(id, req.businessId);
    }

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: deleted ? 'USER_DELETED' : 'USER_ARCHIVED',
      entity: 'user',
      entityId: id,
      description: `User ${targetUser.name} (${targetUser.email}) ${deleted ? 'deleted' : 'deactivated'}`,
      metadata: { targetEmail: targetUser.email, hardDeleted: deleted },
    });

    return res.json({
      success: true,
      message: deleted
        ? `Employee account "${targetUser.name}" deleted successfully.`
        : `Employee account "${targetUser.name}" deactivated and archived to preserve sales history.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
