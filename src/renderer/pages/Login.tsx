import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Session } from '../App';
import TitleBar from '../components/TitleBar';

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginProps {
  onLogin: (session: Session) => void;
}

export default function LoginPage({ onLogin }: LoginProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>();

  // Branch selection state
  const [loggedInSession, setLoggedInSession] = useState<Session | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setError('');
      const session = await window.electronAPI.auth.login({
        username: data.username,
        password: data.password,
        remember: rememberMe,
      });
      if (session) {
        const allBranches = await window.electronAPI.branches.getAll();
        if (allBranches.length <= 1) {
          onLogin(session);
          return;
        }
        setBranches(allBranches);
        setSelectedBranchId(allBranches[0]?.id || null);
        setLoggedInSession(session);
      } else {
        setError(t('Invalid username or password'));
      }
    } catch {
      setError(t('Login failed. Please try again.'));
    }
  };

  const handleBranchConfirm = () => {
    if (loggedInSession && selectedBranchId) {
      onLogin({ ...loggedInSession, branch_id: selectedBranchId });
    }
  };

  // Branch selection screen
  if (loggedInSession) {
    return (
      <div className="flex flex-col h-screen bg-surface">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-6">
          <main className="w-full max-w-md">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-container-lowest shadow-[0px_20px_40px_rgba(25,28,29,0.06)] mb-6">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '2.5rem' }}>
                  store
                </span>
              </div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
                {t('Select Branch')}
              </h1>
              <p className="text-secondary text-sm tracking-wide">
                {t('Choose the branch you are working at today')}
              </p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-10 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] border border-outline-variant/10">
              <div className="space-y-3">
                {branches.map((branch: any) => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                      selectedBranchId === branch.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-outline-variant/30 bg-surface hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold ${
                      selectedBranchId === branch.id
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {branch.prefix}
                    </div>
                    <div>
                      <p className="font-semibold text-on-surface">{branch.name_en}</p>
                      {branch.name_ar && (
                        <p className="text-sm text-secondary mt-0.5" dir="rtl">{branch.name_ar}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-6">
                <button
                  onClick={handleBranchConfirm}
                  disabled={!selectedBranchId}
                  className="btn-primary w-full h-14 rounded-lg font-headline font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {t('Continue')}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      <TitleBar />
      <div className="absolute top-10 right-4 flex items-center gap-2 z-50">
        <button
          type="button"
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-sm font-medium text-on-surface"
        >
          <span className="material-symbols-outlined text-base">{locale === 'en' ? 'language' : 'translate'}</span>
          {locale === 'en' ? 'عربي' : 'English'}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface"
        >
          <span className="material-symbols-outlined text-base">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6"
        style={{
          backgroundImage: 'radial-gradient(var(--color-outline-variant) 0.5px, transparent 0.5px)',
          backgroundSize: '24px 24px',
        }}
      >
      <main className="w-full max-w-md">
        {/* Brand Identity Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-container-lowest shadow-[0px_20px_40px_rgba(25,28,29,0.06)] mb-6">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '2.5rem' }}>
              straighten
            </span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
            {t('Etiquette Tailor')}
          </h1>
          <p className="text-secondary text-sm tracking-wide">
            {t('Bespoke Studio')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-lowest rounded-xl p-10 shadow-[0px_20px_40px_rgba(25,28,29,0.06)] border border-outline-variant/10">
          {error && (
            <div className="mb-6 p-3 bg-error-container text-on-error-container rounded-lg text-sm font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Username Field */}
            <div className="relative group">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                htmlFor="username"
              >
                {t('Username')}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-outline">
                  person
                </span>
                <input
                  {...register('username', { required: t('Username is required') })}
                  id="username"
                  type="text"
                  className="input-field pl-12"
                  placeholder={t('Workshop ID or Email')}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="relative group">
              <div className="flex justify-between items-center mb-2 px-1">
                <label
                  className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary"
                  htmlFor="password"
                >
                  {t('Password')}
                </label>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-outline">
                  lock
                </span>
                <input
                  {...register('password', { required: t('Password is required') })}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-12 pr-12"
                  placeholder={t('Enter your password')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-4 text-outline hover:text-primary transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe((v) => !v)}
                className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-colors ${
                  rememberMe
                    ? 'bg-primary border-primary text-on-primary'
                    : 'bg-surface border-outline text-transparent hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
              </button>
              <label
                className="text-sm text-on-surface cursor-pointer select-none"
                onClick={() => setRememberMe((v) => !v)}
              >
                {t('Remember me')}
              </label>
            </div>

            {/* Login Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full h-14 rounded-lg font-headline font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? t('Signing in...') : t('Sign In')}
                {!isSubmitting && (
                  <span className="material-symbols-outlined">arrow_forward</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <span className="h-px w-8 bg-outline-variant/40" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline/60">
              {t('Bespoke Security Standards')}
            </p>
            <span className="h-px w-8 bg-outline-variant/40" />
          </div>
          <p className="text-[11px] text-secondary/60 font-medium">
            {t('© 2026 Etiquette Tailor System. All rights reserved.')}
          </p>
        </footer>
      </main>

      {/* Visual Accent Element */}
      <div className="fixed bottom-0 right-0 p-12 opacity-5 pointer-events-none hidden lg:block">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20rem' }}>
          straighten
        </span>
      </div>
      </div>
    </div>
  );
}
