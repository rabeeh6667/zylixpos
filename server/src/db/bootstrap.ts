import { isPg, transaction } from './dbAdapter.ts';
import { hashPassword } from '../utils/password.ts';
import { cryptoUUID } from '../utils/crypto.ts';

export interface BootstrapResult {
  success: boolean;
  action: 'INITIALIZED' | 'PROMOTED' | 'ALREADY_EXISTS' | 'SKIPPED_NO_SECRET';
  email?: string;
  message: string;
}

/**
 * Secure, idempotent bootstrap for ZYLIX Platform Owner.
 *
 * Rules:
 * 1. NEVER creates a default/hardcoded password in production or local environments.
 * 2. Requires explicitly configured PLATFORM_OWNER_PASSWORD environment variable for fresh initialization.
 * 3. Idempotent: If an active platform owner already exists, their credentials are NEVER overwritten or demoted.
 * 4. If an existing account with PLATFORM_OWNER_EMAIL already exists, promotes it to platform owner without changing password.
 * 5. Safe across concurrent server starts: Uses PostgreSQL advisory xact lock and SQLite transaction mutex.
 */
class BootstrapMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          next();
        } else {
          this.locked = false;
        }
      };

      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}

const bootstrapMutex = new BootstrapMutex();

export async function bootstrapPlatformOwner(): Promise<BootstrapResult> {
  const releaseLock = await bootstrapMutex.acquire();
  try {
    const targetEmail = (process.env.PLATFORM_OWNER_EMAIL || 'owner@zylix.com').trim().toLowerCase();
    const ownerName = process.env.PLATFORM_OWNER_NAME || 'Platform Administrator';
    const secretPassword = process.env.PLATFORM_OWNER_PASSWORD || process.env.INITIAL_OWNER_PASSWORD;

    return await transaction(async (tx) => {
      // 0. Acquire advisory lock on PostgreSQL to prevent concurrent bootstrap races across multi-pod starts
      if (isPg()) {
        await tx.execute('SELECT pg_advisory_xact_lock(hashtext(?))', ['zylix_platform_owner_bootstrap']);
      }

      // 1. Check if any platform owner already exists in the system
      const existingPlatformOwner = await tx.queryOne<{ id: string; email: string; is_platform_owner: number }>(`
        SELECT id, email, is_platform_owner
        FROM users
        WHERE is_platform_owner = 1 AND status = 'ACTIVE'
        LIMIT 1
      `);

      if (existingPlatformOwner) {
        return {
          success: true,
          action: 'ALREADY_EXISTS',
          email: existingPlatformOwner.email,
          message: `Platform owner already configured (${existingPlatformOwner.email}). Existing credentials preserved.`,
        };
      }

      // 2. Check if a user with target email already exists in the system
      const existingUserByEmail = await tx.queryOne<{ id: string; email: string; role: string; status: string }>(`
        SELECT id, email, role, status
        FROM users
        WHERE LOWER(TRIM(email)) = ?
        LIMIT 1
      `, [targetEmail]);

      if (existingUserByEmail) {
        // Elevate existing user without modifying their existing password hash
        await tx.execute(`
          UPDATE users
          SET is_platform_owner = 1, role = 'OWNER', status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [existingUserByEmail.id]);

        return {
          success: true,
          action: 'PROMOTED',
          email: targetEmail,
          message: `Existing user account (${targetEmail}) promoted to Platform Owner without modifying credentials.`,
        };
      }

      // 3. For a fresh database with no existing owner and no matching account:
      // Requires explicit secret password via environment variable
      if (!secretPassword || secretPassword.trim().length === 0) {
        return {
          success: true,
          action: 'SKIPPED_NO_SECRET',
          message: 'No existing platform owner found, and PLATFORM_OWNER_PASSWORD is not set. Bootstrap skipped safely without creating default credentials.',
        };
      }

      // 4. Create fresh platform owner within the atomic transaction
      const businessId = cryptoUUID();
      const userId = cryptoUUID();
      const passwordHash = await hashPassword(secretPassword.trim());

      // Platform headquarters business
      await tx.execute(`
        INSERT INTO businesses (id, name, business_type, status, currency, timezone)
        VALUES (?, ?, ?, 'ACTIVE', 'INR', 'Asia/Kolkata')
      `, [businessId, 'ZYLIX Platform HQ', 'Platform System']);

      // Platform owner user
      const userInsert = await tx.execute(`
        INSERT INTO users (id, business_id, name, email, password_hash, role, status, is_platform_owner)
        VALUES (?, ?, ?, ?, ?, 'OWNER', 'ACTIVE', 1)
        ON CONFLICT (email) DO NOTHING
      `, [userId, businessId, ownerName, targetEmail, passwordHash]);

      if (userInsert.rowsAffected === 0) {
        return {
          success: true,
          action: 'ALREADY_EXISTS',
          email: targetEmail,
          message: `Platform owner already configured concurrently for ${targetEmail}.`,
        };
      }

      return {
        success: true,
        action: 'INITIALIZED',
        email: targetEmail,
        message: `Fresh Platform Owner initialized successfully for ${targetEmail} using configured secret.`,
      };
    });
  } finally {
    releaseLock();
  }
}
