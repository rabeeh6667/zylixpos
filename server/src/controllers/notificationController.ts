import { Request, Response } from 'express';
import { db } from '../db/index.ts';

export async function getNotifications(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const { isRead, limit = '50' } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));

    let whereClause = 'WHERE business_id = ? AND (user_id IS NULL OR user_id = ?)';
    const params: any[] = [businessId, req.user?.userId || null];

    if (isRead !== undefined) {
      whereClause += ' AND is_read = ?';
      params.push(isRead === 'true' || isRead === '1' ? 1 : 0);
    }

    const notifications = db.prepare(`
      SELECT *
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params, limitNum);

    return res.json({
      success: true,
      notifications,
    });
  } catch (err: any) {
    console.error('[getNotifications Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const userId = req.user?.userId || null;

    const row = db.prepare(`
      SELECT COUNT(id) as unreadCount
      FROM notifications
      WHERE business_id = ? AND (user_id IS NULL OR user_id = ?) AND is_read = 0
    `).get(businessId, userId) as any || { unreadCount: 0 };

    return res.json({
      success: true,
      unreadCount: Number(row.unreadCount || 0),
    });
  } catch (err: any) {
    console.error('[getUnreadCount Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function markNotificationAsRead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const businessId = req.businessId;

    const existing = db.prepare('SELECT id FROM notifications WHERE id = ? AND business_id = ?').get(id, businessId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found in your business tenant.',
      });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND business_id = ?').run(id, businessId);

    return res.json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (err: any) {
    console.error('[markNotificationAsRead Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function markAllNotificationsAsRead(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const userId = req.user?.userId || null;

    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE business_id = ? AND (user_id IS NULL OR user_id = ?) AND is_read = 0
    `).run(businessId, userId);

    return res.json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (err: any) {
    console.error('[markAllNotificationsAsRead Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
