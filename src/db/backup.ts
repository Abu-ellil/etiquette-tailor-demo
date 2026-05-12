import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import db from './schema';

const dbPath = path.join(app.getPath('userData'), 'app.db');
const historyPath = path.join(app.getPath('userData'), 'backup-history.json');

export interface BackupInfo {
  name: string;
  date: string;
  size: string;
  path: string;
}

function readHistory(): BackupInfo[] {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch { /* empty */ }
  return [];
}

function writeHistory(entries: BackupInfo[]) {
  fs.writeFileSync(historyPath, JSON.stringify(entries.slice(0, 20), null, 2), 'utf-8');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export async function createBackup(parentWindow?: BrowserWindow): Promise<{ success: boolean; path?: string; error?: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultName = `etiquette-backup-${timestamp}.db`;

  const result = await dialog.showSaveDialog(parentWindow!, {
    title: 'Save Backup',
    defaultPath: defaultName,
    filters: [{ name: 'Database', extensions: ['db'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Cancelled' };
  }

  try {
    // Checkpoint WAL to main DB file before copying
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, result.filePath);

    // Log to history
    const stat = fs.statSync(result.filePath);
    const history = readHistory();
    history.unshift({
      name: path.basename(result.filePath),
      date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      size: formatBytes(stat.size),
      path: result.filePath,
    });
    writeHistory(history);

    return { success: true, path: result.filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function restoreBackup(parentWindow?: BrowserWindow): Promise<{ success: boolean; error?: string }> {
  const result = await dialog.showOpenDialog(parentWindow!, {
    title: 'Select Backup File to Restore',
    filters: [{ name: 'Database', extensions: ['db'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Cancelled' };
  }

  const backupFile = result.filePaths[0];

  try {
    // Validate it's a readable SQLite file
    const header = Buffer.alloc(16);
    const fd = fs.openSync(backupFile, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    if (header.toString('ascii', 0, 6) !== 'SQLite') {
      return { success: false, error: 'Not a valid SQLite database file' };
    }

    // Close current DB connection
    db.close();

    // Replace the DB file
    fs.copyFileSync(backupFile, dbPath);

    // The app needs to restart to re-open the DB
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function listLocalBackups(): BackupInfo[] {
  return readHistory();
}

export function getLastBackupDate(): string | null {
  const history = readHistory();
  return history.length > 0 ? history[0].date : null;
}

export function getDbFileSize(): { usedBytes: number; label: string } {
  try {
    const stat = fs.statSync(dbPath);
    return {
      usedBytes: stat.size,
      label: formatBytes(stat.size),
    };
  } catch {
    return { usedBytes: 0, label: '0 B' };
  }
}
