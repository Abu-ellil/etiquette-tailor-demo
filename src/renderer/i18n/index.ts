import ar from './ar';

export type Locale = 'en' | 'ar';

export function translate(locale: Locale, key: string): string {
  if (locale === 'en') return key;
  return ar[key] ?? key;
}
