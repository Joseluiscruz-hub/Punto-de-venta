import React from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  expanded: boolean;
}

export function NavItem({ icon, label, active, onClick, expanded }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        nav-link relative flex items-center h-12 transition-all duration-200 group
        ${expanded ? 'px-4 gap-4 w-full' : 'px-0 justify-center w-12 mx-auto'}
        ${
          active
            ? 'nav-link-active bg-white/90 dark:bg-white/10 text-slate-900 dark:text-slate-50 shadow-lg'
            : 'text-slate-500 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-white/5'
        }
      `}
      title={!expanded ? label : undefined}
    >
      <div
        className={`shrink-0 ${active ? 'text-slate-900 dark:text-slate-50' : 'text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-300'}`}
      >
        {icon}
      </div>
      {expanded && (
        <span
          className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-opacity duration-200 ${active ? 'text-slate-900 dark:text-white' : ''}`}
        >
          {label}
        </span>
      )}
      {active && !expanded && <div className="absolute left-0 w-1 h-6 bg-teal-500 rounded-r-full" />}
    </button>
  );
}
