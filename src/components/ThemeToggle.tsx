import { Sun, Moon } from 'lucide-react';
import { useAppTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useAppTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-pressed={isDark}
      title={isDark ? 'Cambiar a modo claro (Ctrl/Cmd+J)' : 'Cambiar a modo oscuro (Ctrl/Cmd+J)'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="top-icon-button transition-all"
    >
      {isDark ? (
        <Sun size={18} className="text-white" />
      ) : (
        <Moon size={18} className="text-slate-700" />
      )}
    </button>
  );
}
