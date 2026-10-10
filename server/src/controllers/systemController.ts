import { Request, Response } from 'express';
import {
  createBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
  getDatabaseHealth
} from '../services/backupService.ts';

export async function handleCreateBackup(req: Request, res: Response) {
  try {
    const businessId = req.businessId!;
    const userId = req.user?.userId;

    const backup = await createBackup(businessId, userId);

    return res.status(201).json({
      success: true,
      message: 'Database backup created successfully.',
      backup,
    });
  } catch (err: any) {
    console.error('[Create Backup Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create database backup. ' + (err.message || ''),
    });
  }
}

export async function handleListBackups(req: Request, res: Response) {
  try {
    const backups = listBackups();

    return res.json({
      success: true,
      count: backups.length,
      backups,
    });
  } catch (err: any) {
    console.error('[List Backups Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function handleDeleteBackup(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const businessId = req.businessId!;
    const userId = req.user?.userId;

    deleteBackup(String(id), businessId, userId);

    return res.json({
      success: true,
      message: `Backup file '${id}' deleted successfully.`,
    });
  } catch (err: any) {
    console.error('[Delete Backup Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function handleRestoreBackup(req: Request, res: Response) {
  try {
    const { filename, confirmRestore } = req.body;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Backup filename is required for restoration.',
      });
    }

    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation payload (confirmRestore: true) is required to restore database.',
      });
    }

    const businessId = req.businessId!;
    const userId = req.user?.userId;

    const result = await restoreBackup(filename, businessId, userId);

    return res.json({
      success: true,
      message: result.message,
      safetyBackup: result.safetyBackup,
      integrity: result.integrity,
    });
  } catch (err: any) {
    console.error('[Restore Backup Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Database restoration failed. ' + (err.message || ''),
    });
  }
}

export async function handleDatabaseHealth(req: Request, res: Response) {
  try {
    const health = getDatabaseHealth();
    return res.json({
      success: true,
      health,
    });
  } catch (err: any) {
    console.error('[Database Health Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
