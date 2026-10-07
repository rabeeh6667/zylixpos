import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { hashPassword, comparePassword } from '../utils/password.ts';
import { generateToken } from '../utils/jwt.ts';
import { cryptoUUID } from '../utils/crypto.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { z } from 'zod';

const registerSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessType: z.string().min(2, 'Business type is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(3, 'Phone number is required'),
  city: z.string().min(2, 'City is required'),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response) {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { businessName, businessType, ownerName, email, password, phone, city, address } = parseResult.data;

    // Check if email already registered
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const businessId = cryptoUUID();
    const userId = cryptoUUID();
    const passwordHash = await hashPassword(password);

    // Run transaction
    const insertBusiness = db.prepare(`
      INSERT INTO businesses (id, name, business_type, phone, email, address, city, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `);

    const insertUser = db.prepare(`
      INSERT INTO users (id, business_id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'OWNER', 'PENDING')
    `);

    const insertSetting = db.prepare(`
      INSERT INTO settings (id, business_id, key, value)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      insertBusiness.run(businessId, businessName, businessType, phone, email.toLowerCase(), address || null, city);
      insertUser.run(userId, businessId, ownerName, email.toLowerCase(), passwordHash);
      
      // Default business settings
      insertSetting.run(cryptoUUID(), businessId, 'currency', 'USD');
      insertSetting.run(cryptoUUID(), businessId, 'currency_symbol', '$');
      insertSetting.run(cryptoUUID(), businessId, 'tax_rate', '8.5');
      insertSetting.run(cryptoUUID(), businessId, 'receipt_header', `${businessName} - Powering Better Business.`);
      insertSetting.run(cryptoUUID(), businessId, 'low_stock_threshold', '5');
      insertSetting.run(cryptoUUID(), businessId, 'allow_negative_inventory', 'false');
    })();

    logAuditEvent({
      businessId,
      userId,
      action: 'BUSINESS_REGISTERED_PENDING',
      entity: 'business',
      entityId: businessId,
      metadata: { businessName, businessType, ownerName, email, phone, city },
    });

    return res.status(201).json({
      success: true,
      message: 'Request has been sent to ZYLIX team. We will contact you soon!',
      pending: true,
    });
  } catch (err: any) {
    console.error('[Register Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register business. ' + (err.message || ''),
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, password } = parseResult.data;

    const user = db.prepare(`
      SELECT u.id, u.business_id, u.name, u.email, u.password_hash, u.role, u.status, u.is_platform_owner,
             b.name as business_name, b.business_type, b.logo, b.status as business_status
      FROM users u
      JOIN businesses b ON u.business_id = b.id
      WHERE u.email = ?
    `).get(email.toLowerCase()) as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'UNAUTHORIZED',
      });
    }

    if (user.status === 'PENDING' || user.business_status === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Request has been sent to ZYLIX team. We will contact you soon!',
        code: 'TENANT_PENDING',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact your business owner.',
        code: 'FORBIDDEN',
      });
    }

    if (user.business_status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your business account is suspended. Please contact ZYLIX platform support.',
        code: 'TENANT_SUSPENDED',
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      logAuditEvent({
        businessId: user.business_id,
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'user',
        entityId: user.id,
        description: `Failed login attempt for ${user.email}`,
        metadata: { email: user.email },
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'UNAUTHORIZED',
      });
    }

    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    const isPlatformOwner = Boolean(
      user.role === 'OWNER' &&
      user.status === 'ACTIVE' &&
      normalizedEmail === 'owner@zylix.com'
    );

    const tokenPayload = {
      userId: user.id,
      businessId: user.business_id,
      email: user.email,
      name: user.name,
      role: user.role,
      isPlatformOwner,
    };

    const token = generateToken(tokenPayload);

    logAuditEvent({
      businessId: user.business_id,
      userId: user.id,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
      description: `User ${user.name} logged in`,
      metadata: { email: user.email, role: user.role },
    });

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformOwner,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
        businessType: user.business_type,
        logo: user.logo,
        status: user.business_status || 'ACTIVE',
      },
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login.',
    });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    const user = db.prepare(`
      SELECT u.id, u.business_id, u.name, u.email, u.role, u.status, u.is_platform_owner, u.created_at,
             b.name as business_name, b.business_type, b.phone, b.email as business_email, b.address, b.logo, b.status as business_status
      FROM users u
      JOIN businesses b ON u.business_id = b.id
      WHERE u.id = ? AND u.business_id = ?
    `).get(req.user.userId, req.businessId) as any;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User or Business record not found.' });
    }

    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    const isPlatformOwner = Boolean(
      user.role === 'OWNER' &&
      user.status === 'ACTIVE' &&
      normalizedEmail === 'owner@zylix.com'
    );

    console.log(`[CURRENT USER ME]
userId=${user.id}
email=${user.email}
role=${user.role}
businessId=${user.business_id}
isPlatformOwner=${isPlatformOwner}`);

    if (user.business_status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your business account is suspended. Please contact ZYLIX platform support.',
        code: 'TENANT_SUSPENDED',
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isPlatformOwner,
        createdAt: user.created_at,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
        businessType: user.business_type,
        phone: user.phone,
        email: user.business_email,
        address: user.address,
        logo: user.logo,
        status: user.business_status || 'ACTIVE',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function logout(req: Request, res: Response) {
  if (req.user && req.businessId) {
    logAuditEvent({
      businessId: req.businessId,
      userId: req.user.userId,
      action: 'USER_LOGOUT',
      entity: 'user',
      entityId: req.user.userId,
    });
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
}
