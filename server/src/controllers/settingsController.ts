import { Request, Response } from 'express';
import { query, execute, transaction } from '../db/dbAdapter.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';

export async function getSettings(req: Request, res: Response) {
  try {
    const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings WHERE business_id = ?', [req.businessId]);
    
    const settingsObj: Record<string, string> = {};
    rows.forEach((r) => {
      settingsObj[r.key] = r.value;
    });

    return res.json({
      success: true,
      settings: settingsObj,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
    }

    await transaction(async (tx) => {
      for (const [key, val] of Object.entries(settings)) {
        await tx.execute(`
          INSERT INTO settings (id, business_id, key, value, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(business_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [cryptoUUID(), req.businessId, key, String(val)]);
      }
    });

    const hasReceiptSetting = Object.keys(settings).some(k => k.toLowerCase().includes('receipt'));
    const action = hasReceiptSetting ? 'RECEIPT_SETTINGS_UPDATED' : 'BUSINESS_SETTINGS_UPDATED';

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action,
      entity: 'settings',
      description: hasReceiptSetting ? 'Receipt settings updated' : 'Business settings updated',
      metadata: settings,
    });

    return res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
