import crypto from 'crypto';

export function cryptoUUID(): string {
  return crypto.randomUUID();
}
