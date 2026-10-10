import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.ts';
import { queryOne } from '../db/dbAdapter.ts';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
      code: 'UNAUTHORIZED',
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.',
      code: 'UNAUTHORIZED',
    });
  }

  req.user = payload;
  req.businessId = payload.businessId;
  req.userRole = payload.role;

  next();
}

/**
 * Enforces role-based authorization (RBAC)
 */
export function requireRole(
  ...allowedRoles: ('OWNER' | 'MANAGER' | 'CASHIER' | ('OWNER' | 'MANAGER' | 'CASHIER')[])[]
) {
  const roles = allowedRoles.flat();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Action requires one of roles: [${roles.join(', ')}]. Your role is ${req.userRole}.`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Enforces ZYLIX Platform Owner authorization.
 *
 * IMPORTANT:
 * Platform-owner status is verified from the database instead of
 * relying only on the value stored inside an existing JWT.
 */
export async function requirePlatformOwner(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    console.log(`[PLATFORM AUTH]
jwtUserId=UNAUTHENTICATED
jwtEmail=UNAUTHENTICATED
dbUserId=NONE
dbEmail=NONE
role=NONE
businessId=NONE
isPlatformOwner=0
authorized=false`);
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
    });
  }

  const platformOwner = await queryOne<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    business_id: string;
    is_platform_owner: number;
  }>(
    `
      SELECT id, name, email, role, status, business_id, is_platform_owner
      FROM users
      WHERE id = ?
    `,
    [req.user.userId]
  );

  const normalizedEmail = String(platformOwner?.email || '').trim().toLowerCase();

  const isAuthorized = Boolean(
    platformOwner &&
    platformOwner.status === 'ACTIVE' &&
    platformOwner.role === 'OWNER' &&
    normalizedEmail === 'owner@zylix.com'
  );

  console.log(`[PLATFORM AUTH]
jwtUserId=${req.user.userId || 'N/A'}
jwtEmail=${req.user.email || 'N/A'}
dbUserId=${platformOwner?.id || 'NOT_FOUND'}
dbEmail=${platformOwner?.email || 'NOT_FOUND'}
role=${platformOwner?.role || 'NONE'}
businessId=${platformOwner?.business_id || req.businessId || 'NONE'}
isPlatformOwner=${platformOwner?.is_platform_owner ?? 0}
authorized=${isAuthorized}`);

  if (!platformOwner) {
    return res.status(401).json({
      success: false,
      message: 'User account not found.',
      code: 'UNAUTHORIZED',
    });
  }

  if (platformOwner.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'Your account is not active.',
      code: 'FORBIDDEN',
    });
  }

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. ZYLIX Platform Owner authorization required.',
      code: 'FORBIDDEN',
    });
  }

  // Keep request user state synchronized with the database.
  req.user.isPlatformOwner = true;
  req.userRole = 'OWNER';

  next();
}