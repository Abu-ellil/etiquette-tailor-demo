import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import TitleBar from '../components/TitleBar';

interface LicenseProps {
  onActivated: () => void;
  onDemoMode: () => void;
}

interface DemoUsage {
  ordersUsed: number;
  ordersMax: number;
  daysUsed: number;
  daysMax: number;
  daysRemaining: number;
}

interface LicenseStatus {
  status: 'none' | 'trial' | 'full' | 'demo' | 'expired' | 'hw_mismatch';
  key: string;
  clientName?: string;
  clientEmail?: string;
  expiryDate?: string;
  maxBranches: number;
  daysRemaining?: number;
  isDemo: boolean;
  hardwareId?: string;
}

export default function LicensePage({ onActivated, onDemoMode }: LicenseProps) {
  const { t } = useTranslation();
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [demoUsage, setDemoUsage] = useState<DemoUsage | null>(null);
  const [hardwareId, setHardwareId] = useState<string>('');
  const [hwidCopied, setHwidCopied] = useState(false);

  useEffect(() => {
    loadLicenseStatus();
    loadHardwareId();
  }, []);

  const loadLicenseStatus = async () => {
    try {
      const status = await window.electronAPI.license.getStatus();
      setLicenseStatus(status);

      if (status.isDemo) {
        const usage = await window.electronAPI.license.getDemoUsage();
        setDemoUsage(usage);
      }
    } catch (e) {
      console.error('Failed to load license status:', e);
    }
  };

  const loadHardwareId = async () => {
    try {
      const hwid = await window.electronAPI.license.getHardwareId();
      setHardwareId(hwid);
    } catch (e) {
      console.error('Failed to load hardware ID:', e);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const result = await window.electronAPI.license.activate(licenseKey.trim());

      if (result.success) {
        setSuccess(true);
        setTimeout(() => onActivated(), 1500);
      } else {
        setError(result.error || 'Activation failed');
      }
    } catch (e) {
      setError('Failed to activate license. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    setLoading(true);
    try {
      await window.electronAPI.license.enableDemo();
      onDemoMode();
    } catch (e) {
      setError('Failed to enable demo mode');
      setLoading(false);
    }
  };

  const handleCopyHwid = () => {
    navigator.clipboard.writeText(hardwareId);
    setHwidCopied(true);
    setTimeout(() => setHwidCopied(false), 2000);
  };

  const handleContact = () => {
    const subject = encodeURIComponent('Etiquette Tailor License Request');
    const body = encodeURIComponent(`Hi,

I would like to purchase a license for Etiquette Tailor.

My Hardware ID is: ${hardwareId}

Please provide me with a license key.

Thank you.`);
    window.open(`mailto:mr.abuellil@gmail.com?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-surface">
      <TitleBar />

      <div className="absolute top-10 right-4 flex items-center gap-2 z-50">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-sm font-medium text-on-surface"
          onClick={() => window.electronAPI.shell.openExternal('https://github.com/Abu-ellil/etiquette-tailor')}
        >
          <span className="material-symbols-outlined text-base">code</span>
          GitHub
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto"
        style={{
          backgroundImage: 'radial-gradient(var(--color-outline-variant) 0.5px, transparent 0.5px)',
          backgroundSize: '24px 24px',
        }}
      >
        <main className="w-full max-w-lg pb-8">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-lowest shadow-lg mb-4">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '2rem' }}>
                verified_user
              </span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface mb-1">
              Etiquette Tailor
            </h1>
            <p className="text-secondary text-sm">License Activation</p>
          </div>

          {/* Hardware ID Card */}
          <div className="mb-4 bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary mt-0.5">fingerprint</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary mb-1">Your Hardware ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-on-surface bg-surface-container-high px-2 py-1 rounded truncate">
                    {hardwareId || 'Loading...'}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHwid}
                    className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    title="Copy Hardware ID"
                  >
                    <span className="material-symbols-outlined text-base">
                      {hwidCopied ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-secondary mt-2">
                  Share this ID to receive a license key locked to this device.
                </p>
              </div>
            </div>
          </div>

          {/* Demo Mode Active Notice */}
          {licenseStatus?.isDemo && demoUsage && (
            <div className="mb-4 p-4 bg-amber-container/10 border border-amber-container/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber">info</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber text-sm mb-1">Demo Mode Active</p>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div className="bg-surface-container-high rounded-lg p-2">
                      <p className="text-secondary">Orders Used</p>
                      <p className="font-bold text-on-surface">{demoUsage.ordersUsed} / {demoUsage.ordersMax}</p>
                    </div>
                    <div className="bg-surface-container-high rounded-lg p-2">
                      <p className="text-secondary">Days Remaining</p>
                      <p className="font-bold text-on-surface">{demoUsage.daysRemaining}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hardware ID Mismatch Warning */}
          {licenseStatus?.status === 'hw_mismatch' && (
            <div className="mb-4 p-4 bg-error-container/10 border border-error-container/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-error">warning</span>
                <div className="flex-1">
                  <p className="font-semibold text-error text-sm mb-1">License Locked to Another Device</p>
                  <p className="text-xs text-secondary">
                    Your license is activated on a different computer. Please contact support to transfer it.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* License Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] border border-outline-variant/10">
            {success ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-container text-on-primary-container mb-3">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.75rem' }}>check</span>
                </div>
                <h2 className="text-lg font-bold text-on-surface mb-1">License Activated!</h2>
                <p className="text-sm text-secondary">Redirecting to login...</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="font-semibold text-on-surface mb-2">Enter Your License Key</h2>
                  <p className="text-sm text-secondary">
                    Enter the license key provided for your Hardware ID above.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm font-medium flex items-start gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleActivate} className="space-y-4">
                  <div>
                    <label htmlFor="licenseKey" className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      License Key
                    </label>
                    <input
                      id="licenseKey"
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      className="input-field font-mono text-center tracking-wider"
                      placeholder="ETIK-XXXX-XXXX-XXXX-XXXX"
                      maxLength={24}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!licenseKey || loading}
                    className="btn-primary w-full h-12 rounded-lg font-headline font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Activate License'}
                    {!loading && <span className="material-symbols-outlined">verified</span>}
                  </button>
                </form>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant/30" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-surface-container-lowest text-secondary">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDemoMode}
                  disabled={loading}
                  className="w-full h-12 rounded-lg font-headline font-semibold border-2 border-outline-variant/30 text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">play_circle</span>
                  Try Demo Mode
                </button>
              </>
            )}
          </div>

          {/* Contact Section */}
          <div className="mt-5 text-center">
            <p className="text-sm text-secondary mb-2">Don't have a license?</p>
            <button
              type="button"
              onClick={handleContact}
              className="text-sm font-medium text-primary hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <span className="material-symbols-outlined text-base">email</span>
              Request License
            </button>
            <p className="text-xs text-secondary/60 mt-2">
              mr.abuellil@gmail.com
            </p>
          </div>

          {/* Version Info */}
          <footer className="mt-6 text-center">
            <p className="text-[11px] text-secondary/60 font-medium">
              v{window.electronAPI.app.getVersion()} • © 2026 Etiquette Tailor
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
