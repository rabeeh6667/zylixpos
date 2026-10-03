import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.ts';

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
export function requireRole(...allowedRoles: ('OWNER' | 'MANAGER' | 'CASHIER' | ('OWNER' | 'MANAGER' | 'CASHIER')[])[]) {
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
 * Enforces ZYLIX Platform Owner capability authorization
 */
export function requirePlatformOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
    });
  }

  if (!req.user.isPlatformOwner) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. ZYLIX Platform Owner authorization required.',
      code: 'FORBIDDEN',
    });
  }

  next();
}
