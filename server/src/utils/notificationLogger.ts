import { execute } from '../db/dbAdapter.ts';
import { cryptoUUID } from './crypto.ts';

export interface NotificationParams {
  businessId: string;
  userId?: string | null;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SALE_COMPLETED' | 'EXPENSE_RECORDED' | 'USER_ADDED' | 'SYSTEM';
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}

export async function createNotification(params: NotificationParams) {
  try {
    await execute(
      `
        INSERT INTO notifications (
          id, business_id, user_id, type, title, message, entity_type, entity_id, is_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `,
      [
        cryptoUUID(),
        params.businessId,
        params.userId || null,
        params.type,
        params.title,
        params.message,
        params.entityType || null,
        params.entityId || null,
      ]
    );
  } catch (err) {
    console.error('[NotificationLog Error]', err);
  }
}
