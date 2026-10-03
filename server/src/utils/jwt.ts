import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';

export interface TokenPayload {
  userId: string;
  businessId: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  isPlatformOwner?: boolean;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (error) {
    return null;
  }
}
