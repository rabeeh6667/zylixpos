import { TokenPayload } from '../utils/jwt.ts';

declare module 'better-sqlite3';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      businessId?: string;
      userRole?: 'OWNER' | 'MANAGER' | 'CASHIER';
    }
  }
}

