import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    window.electronAPI.settings
      .getAll()
      .then((settings: Record<string, string>) => {
        const saved = settings.theme as Theme | undefined;
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
          document.documentElement.classList.toggle('dark', saved === 'dark');
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    window.electronAPI.settings.set({ theme: t }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
