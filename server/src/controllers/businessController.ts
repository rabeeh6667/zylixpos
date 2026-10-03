import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  businessType: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
});

export async function getBusiness(req: Request, res: Response) {
  try {
    const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business profile not found.' });
    }
    return res.json({ success: true, business });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateBusiness(req: Request, res: Response) {
  try {
    const parseResult = updateBusinessSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { name, businessType, phone, email, address, logo } = parseResult.data;

    db.prepare(`
      UPDATE businesses
      SET name = ?, business_type = ?, phone = ?, email = ?, address = ?, logo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, businessType, phone || null, email || null, address || null, logo || null, req.businessId);

    logAuditEvent({
      businessId: req.businessId!,
      userId: req.user?.userId,
      action: 'BUSINESS_UPDATED',
      entity: 'business',
      entityId: req.businessId,
      metadata: parseResult.data,
    });

    return res.json({ success: true, message: 'Business details updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
