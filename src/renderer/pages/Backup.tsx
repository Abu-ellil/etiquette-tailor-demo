import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';

interface BackupFile {
  name: string;
  date: string;
  size: string;
}

export default function BackupPage() {
  const { t } = useTranslation();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [dbSize, setDbSize] = useState<{ usedBytes: number; label: string } | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBackupInfo();
  }, []);

  async function loadBackupInfo() {
    try {
      const [lastDate, size, list] = await Promise.all([
        window.electronAPI.backup.lastDate(),
        window.electronAPI.backup.dbSize(),
        window.electronAPI.backup.list(),
      ]);
      setLastBackup(lastDate);
      setDbSize(size);
      setBackups(list);
    } catch (err) {
      console.error('[Backup] Failed to load info:', err);
    }
  }

  const handleBackup = async () => {
    setBackingUp(true);
    setError(null);
    try {
      const result = await window.electronAPI.backup.create();
      if (result.success) {
        await loadBackupInfo();
      } else if (result.error !== 'Cancelled') {
        setError(result.error || t('Backup failed'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    const confirmed = window.confirm(
      t('Restoring a backup will replace ALL current data and restart the app. Are you sure?')
    );
    if (!confirmed) return;

    setRestoring(true);
    setError(null);
    try {
      const result = await window.electronAPI.backup.restore();
      if (!result.success && result.error !== 'Cancelled') {
        setError(result.error || t('Restore failed'));
        setRestoring(false);
      }
      // If successful, app restarts — no need to reset state
    } catch (err: any) {
      setError(err.message);
      setRestoring(false);
    }
  };

  return (
    <div className="pb-12">
      {/* Header */}
      <header className="mb-16">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight mb-4">
              {t('Security & Backup')}
            </h2>
            <p className="text-lg text-secondary max-w-2xl leading-relaxed">
              {t("Protect your studio's legacy. Manage database integrity and restore workshop history.")}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-1">
              {t('System Health')}
            </span>
            <div className="flex items-center gap-2 px-4 py-2 bg-tertiary-fixed text-on-tertiary-fixed rounded-full">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-fixed animate-pulse" />
              <span className="text-xs font-bold">{t('ALL SYSTEMS SECURE')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-error-container border border-error-container text-on-error-container text-sm">
          {error}
        </div>
      )}

      {/* Last Backup Status Banner */}
      <section className="mb-12">
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-low p-8 border-l-4 border-primary">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-primary text-3xl">cloud_done</span>
              </div>
              <div>
                <p className="text-sm text-secondary uppercase tracking-widest mb-1 font-semibold">
                  {t('Last Backup Date')}
                </p>
                <h3 className="text-3xl font-headline font-bold text-on-surface">
                  {lastBackup || t('No backups yet')}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-secondary italic mb-1">{t('Backup location:')}</p>
              <p className="font-bold text-on-surface">{t('Local Disk')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Action Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {/* Backup Now */}
        <div className="group relative flex flex-col p-8 rounded-3xl bg-surface-container-lowest border-b-4 border-primary shadow-[0px_20px_40px_rgba(25,28,29,0.04)] hover:shadow-[0px_30px_60px_rgba(118,57,82,0.1)] transition-all duration-500">
          <div className="w-14 h-14 rounded-xl bg-primary-fixed flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span
              className="material-symbols-outlined text-primary text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              database
            </span>
          </div>
          <h4 className="text-2xl font-headline font-bold text-on-surface mb-3">{t('Backup Data')}</h4>
          <p className="text-secondary leading-relaxed mb-8 flex-1">
            {t('Generate a complete snapshot of all customers, measurements, and financial records.')}
          </p>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold rounded-lg shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {backingUp ? t('Backing Up...') : t('Start Backup Now')}
          </button>
        </div>

        {/* Restore */}
        <div className="group relative flex flex-col p-8 rounded-3xl bg-surface-container-lowest border-b-4 border-secondary shadow-[0px_20px_40px_rgba(25,28,29,0.04)] hover:shadow-[0px_30px_60px_rgba(80,95,118,0.1)] transition-all duration-500">
          <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-secondary text-2xl">
              settings_backup_restore
            </span>
          </div>
          <h4 className="text-2xl font-headline font-bold text-on-surface mb-3">{t('Restore Data')}</h4>
          <p className="text-secondary leading-relaxed mb-8 flex-1">
            {t('Roll back your studio database to a previous state.')}
          </p>
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="w-full py-4 bg-secondary text-white font-headline font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {restoring ? t('Restoring...') : t('Upload Recovery File')}
          </button>
        </div>
      </section>

      {/* DB Size & Backup Files */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* DB Size Card */}
        <div className="p-8 rounded-3xl bg-surface-container flex items-center justify-between">
          <div>
            <h5 className="font-headline font-bold text-on-surface text-xl mb-1">{t('Database Size')}</h5>
            <p className="text-sm text-secondary">{dbSize?.label || '—'}</p>
          </div>
          <span className="material-symbols-outlined text-primary text-3xl">sd_card</span>
        </div>
      </section>

      {/* Backup File List */}
      <section className="bg-surface-container-lowest rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-surface-container">
          <h3 className="font-headline font-bold text-2xl">{t('Recent Backups')}</h3>
        </div>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-secondary">
            {t('No backups yet. Click "Start Backup Now" to create your first backup.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('File Name')}</th>
                  <th>{t('Date')}</th>
                  <th>{t('Size')}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((file, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-lg">
                          database
                        </span>
                        <span className="font-semibold text-sm">{file.name}</span>
                      </div>
                    </td>
                    <td className="text-sm">{file.date}</td>
                    <td className="text-sm font-medium">{file.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer Note */}
      <footer className="mt-16 text-center">
        <p className="text-sm text-secondary/60 font-medium">
          {t('Backups are saved to your chosen location on disk. Keep backup files in a safe place.')}
        </p>
      </footer>
    </div>
  );
}
