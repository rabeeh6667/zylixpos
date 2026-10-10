import { Request, Response } from 'express';
import { query, queryOne } from '../db/dbAdapter.ts';

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const businessId = req.businessId;
    const {
      action,
      entityType,
      userId,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE a.business_id = ?';
    const params: any[] = [businessId];

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(String(action));
    }

    if (entityType) {
      whereClause += ' AND a.entity = ?';
      params.push(String(entityType));
    }

    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(String(userId));
    }

    if (startDate) {
      whereClause += ' AND date(a.created_at, "localtime") >= date(?)';
      params.push(String(startDate));
    }

    if (endDate) {
      whereClause += ' AND date(a.created_at, "localtime") <= date(?)';
      params.push(String(endDate));
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      whereClause += ' AND (a.action LIKE ? OR a.entity LIKE ? OR a.metadata LIKE ? OR u.name LIKE ?)';
      params.push(term, term, term, term);
    }

    // Total Count Query
    const countRow = (await queryOne<any>(`
      SELECT COUNT(a.id) as total
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
    `, params)) || { total: 0 };

    const total = Number(countRow.total || 0);
    const totalPages = Math.ceil(total / limitNum);

    // Items Query
    const items = await query<any>(`
      SELECT a.id, a.business_id, a.user_id, a.action, a.entity as entity_type, a.entity_id, a.metadata, a.created_at, u.name as user_name, u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    // Format metadata JSON if string
    const formattedItems = items.map((item: any) => {
      let meta = item.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          meta = null;
        }
      }
      return {
        ...item,
        metadata: meta
      };
    });

    return res.json({
      success: true,
      items: formattedItems,
      logs: formattedItems,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    });
  } catch (err: any) {
    console.error('[getAuditLogs Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
