import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translate, Locale } from '../i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  isRTL: boolean;
  currency: string;
  setCurrency: (c: string) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
  isRTL: false,
  currency: 'QAR',
  setCurrency: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [currency, setCurrencyState] = useState('QAR');

  useEffect(() => {
    window.electronAPI.settings
      .getAll()
      .then((settings: Record<string, string>) => {
        const saved = settings.locale as Locale | undefined;
        if (saved === 'en' || saved === 'ar') {
          setLocaleState(saved);
          document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = saved;
        }
        if (settings.currency) {
          setCurrencyState(settings.currency);
        }
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
    window.electronAPI.settings.set({ locale: l }).catch(() => {});
  }, []);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    window.electronAPI.settings.set({ currency: c }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string) => translate(locale, key),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isRTL: locale === 'ar', currency, setCurrency }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
