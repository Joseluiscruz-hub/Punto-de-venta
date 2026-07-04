import { Sun, Moon } from 'lucide-react';
import { useAppTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useAppTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 group"
    >
      {isDark ? (
        <Sun size={20} className="group-hover:rotate-45 transition-transform" />
      ) : (
        <Moon size={20} className="group-hover:-rotate-12 transition-transform" />
      )}
      <span className="text-xs font-bold uppercase tracking-widest">
        {isDark ? 'Modo Claro' : 'Modo Oscuro'}
      </span>
    </button>
  );
}
