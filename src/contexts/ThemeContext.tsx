import React, { useEffect, useState } from 'react';
import { ThemeContext } from './theme-context';

const THEME_KEY = 'el-triunfo.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(THEME_KEY) !== 'light');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  // Atajo global: Ctrl/Cmd + J para alternar tema (convención usada en muchas apps)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'j') {
        e.preventDefault();
        setIsDark((v) => !v);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = { isDark, toggleTheme: () => setIsDark((current) => !current) };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

