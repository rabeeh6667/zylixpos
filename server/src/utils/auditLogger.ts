import { db } from '../db/index.ts';
import { cryptoUUID } from './crypto.ts';

export interface AuditParams {
  businessId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, any>;
}

export function logAuditEvent(params: AuditParams) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, business_id, user_id, action, entity, entity_id, description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Clean sensitive data from metadata if present
    let cleanMeta: Record<string, any> | null = null;
    if (params.metadata && typeof params.metadata === 'object') {
      cleanMeta = { ...params.metadata };
      delete cleanMeta.password;
      delete cleanMeta.password_hash;
      delete cleanMeta.token;
      delete cleanMeta.jwt_secret;
      delete cleanMeta.secret;
      delete cleanMeta.credit_card;
      delete cleanMeta.cvv;
    }

    stmt.run(
      cryptoUUID(),
      params.businessId,
      params.userId || null,
      params.action,
      params.entity,
      params.entityId || null,
      params.description || null,
      cleanMeta && Object.keys(cleanMeta).length > 0 ? JSON.stringify(cleanMeta) : null
    );
  } catch (err) {
    console.error('[AuditLog Error]', err);
  }
}

