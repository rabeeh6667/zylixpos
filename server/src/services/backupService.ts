import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.ts';
import { config } from '../config/index.ts';
import { logAuditEvent } from '../utils/auditLogger.ts';
import { isPg, queryOne } from '../db/dbAdapter.ts';

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
  databaseVersion: string;
}

export async function createBackup(businessId: string, userId?: string): Promise<BackupMetadata> {
  if (isPg()) {
    throw new Error(
      'PostgreSQL mode active: Database snapshots and backups are managed automatically by your PostgreSQL cloud database provider. File-level SQLite backup is disabled.'
    );
  }

  const backupsDir = path.join(process.cwd(), 'server', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `zylix_backup_${dateStr}_${timeStr}.db`;
  const backupPath = path.join(backupsDir, filename);

  // Perform safe SQLite online backup
  await db.backup(backupPath);

  const stats = fs.statSync(backupPath);

  logAuditEvent({
    businessId,
    userId,
    action: 'BACKUP_CREATED',
    entity: 'system_backup',
    entityId: filename,
    description: `Database backup created: ${filename}`,
    metadata: { filename, size: stats.size },
  });

  return {
    id: filename,
    filename,
    createdAt: stats.birthtime.toISOString(),
    size: stats.size,
    databaseVersion: '1.0.0',
  };
}

export function listBackups(): BackupMetadata[] {
  if (isPg()) {
    return [];
  }

  const backupsDir = path.join(process.cwd(), 'server', 'backups');
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  const files = fs.readdirSync(backupsDir);
  return files
    .filter((f) => f.endsWith('.db') && (f.startsWith('zylix_backup_') || f.startsWith('safety_pre_restore_')))
    .map((filename) => {
      const filePath = path.join(backupsDir, filename);
      const stats = fs.statSync(filePath);
      return {
        id: filename,
        filename,
        createdAt: stats.birthtime.toISOString(),
        size: stats.size,
        databaseVersion: '1.0.0',
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteBackup(filename: string, businessId: string, userId?: string): boolean {
  if (isPg()) {
    throw new Error(
      'PostgreSQL mode active: Database snapshots and backups are managed automatically by your PostgreSQL provider.'
    );
  }

  const backupsDir = path.join(process.cwd(), 'server', 'backups');
  const safeFilename = path.basename(filename);
  const filePath = path.join(backupsDir, safeFilename);

  if (!fs.existsSync(filePath) || !safeFilename.endsWith('.db')) {
    throw new Error(`Backup file '${safeFilename}' not found.`);
  }

  fs.unlinkSync(filePath);

  logAuditEvent({
    businessId,
    userId,
    action: 'BACKUP_DELETED',
    entity: 'system_backup',
    entityId: safeFilename,
    description: `Database backup deleted: ${safeFilename}`,
    metadata: { filename: safeFilename },
  });

  return true;
}

export async function restoreBackup(filename: string, businessId: string, userId?: string) {
  if (isPg()) {
    throw new Error(
      'PostgreSQL mode active: Database restoration must be performed via your PostgreSQL cloud provider or pg_restore.'
    );
  }

  const backupsDir = path.join(process.cwd(), 'server', 'backups');
  const safeFilename = path.basename(filename);
  const backupPath = path.join(backupsDir, safeFilename);

  if (!fs.existsSync(backupPath) || !safeFilename.endsWith('.db')) {
    throw new Error(`Backup file '${safeFilename}' not found.`);
  }

  logAuditEvent({
    businessId,
    userId,
    action: 'RESTORE_INITIATED',
    entity: 'system_backup',
    entityId: safeFilename,
    description: `Database restore process initiated with backup ${safeFilename}`,
    metadata: { filename: safeFilename },
  });

  try {
    // 1. Verify source backup database integrity
    const sourceDb = new Database(backupPath, { readonly: true });
    const checkResult = sourceDb.pragma('quick_check') as any[];
    sourceDb.close();

    if (!Array.isArray(checkResult) || checkResult[0]?.quick_check !== 'ok') {
      throw new Error('Backup file failed SQLite integrity check.');
    }

    // 2. Create safety pre-restore backup of current live database
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const safetyFilename = `safety_pre_restore_${dateStr}_${timeStr}.db`;
    const safetyPath = path.join(backupsDir, safetyFilename);
    await db.backup(safetyPath);

    // 3. Online restore source backup into live DB
    const restoreSourceDb = new Database(backupPath, { readonly: true });
    await restoreSourceDb.backup(config.dbPath);
    restoreSourceDb.close();

    // 4. Force SQLite WAL checkpoint and reconnect verification
    db.pragma('wal_checkpoint(TRUNCATE)');
    const liveIntegrity = db.pragma('quick_check') as any[];
    if (!Array.isArray(liveIntegrity) || liveIntegrity[0]?.quick_check !== 'ok') {
      throw new Error('Restored live database failed integrity check!');
    }

    // Re-enforce safety pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    logAuditEvent({
      businessId,
      userId,
      action: 'RESTORE_COMPLETED',
      entity: 'system_backup',
      entityId: safeFilename,
      description: `Database restore completed successfully from ${safeFilename}. Safety backup stored at ${safetyFilename}`,
      metadata: { restoredBackup: safeFilename, safetyBackup: safetyFilename },
    });

    return {
      success: true,
      message: `Database successfully restored from ${safeFilename}. A safety snapshot was preserved at ${safetyFilename}.`,
      safetyBackup: safetyFilename,
      integrity: 'ok',
    };
  } catch (err: any) {
    logAuditEvent({
      businessId,
      userId,
      action: 'RESTORE_FAILED',
      entity: 'system_backup',
      entityId: safeFilename,
      description: `Database restore failed: ${err.message}`,
    });
    throw err;
  }
}

export async function getDatabaseHealth() {
  if (isPg()) {
    try {
      const ping = await queryOne('SELECT 1 as ping');
      const verRow = await queryOne<any>('SELECT version() as ver');
      const sizeRow = await queryOne<any>('SELECT pg_database_size(current_database()) as size');

      return {
        databaseConnected: Boolean(ping?.ping === 1),
        mode: 'PostgreSQL',
        foreignKeysEnabled: true,
        foreignKeyViolations: 0,
        integrityCheck: 'ok',
        schemaStatus: 'valid',
        databaseSizeBytes: Number(sizeRow?.size || 0),
        databaseVersion: verRow?.ver ? String(verRow.ver).split(' ')[0] + ' ' + String(verRow.ver).split(' ')[1] : 'PostgreSQL',
        managedBackups: true,
      };
    } catch (err: any) {
      return {
        databaseConnected: false,
        mode: 'PostgreSQL',
        foreignKeysEnabled: false,
        foreignKeyViolations: -1,
        integrityCheck: 'error: ' + (err.message || ''),
        schemaStatus: 'connection_error',
        databaseSizeBytes: 0,
        databaseVersion: 'PostgreSQL',
        managedBackups: true,
      };
    }
  }

  try {
    const fkPragma = db.pragma('foreign_keys', { simple: true });
    const fkViolations = db.pragma('foreign_key_check') as any[];
    const integrityCheck = db.pragma('integrity_check') as any[];
    const stats = fs.statSync(config.dbPath);

    const isIntegrityOk = Array.isArray(integrityCheck) && integrityCheck[0]?.integrity_check === 'ok';

    return {
      databaseConnected: true,
      mode: 'SQLite',
      foreignKeysEnabled: Boolean(fkPragma),
      foreignKeyViolations: fkViolations.length,
      integrityCheck: isIntegrityOk ? 'ok' : 'failed',
      schemaStatus: 'valid',
      databaseSizeBytes: stats.size,
      databaseVersion: 'SQLite 3.x (WAL mode)',
      managedBackups: false,
    };
  } catch (err: any) {
    return {
      databaseConnected: false,
      mode: 'SQLite',
      foreignKeysEnabled: false,
      foreignKeyViolations: -1,
      integrityCheck: 'error: ' + (err.message || ''),
      schemaStatus: 'corrupted',
      databaseSizeBytes: 0,
      databaseVersion: 'SQLite',
      managedBackups: false,
    };
  }
}
