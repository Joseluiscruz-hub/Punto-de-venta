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
        relative flex items-center h-12 rounded-xl transition-all duration-200 group
        ${expanded ? 'px-4 gap-4 w-full' : 'px-0 justify-center w-12 mx-auto'}
        ${
          active
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        }
      `}
      title={!expanded ? label : undefined}
    >
      <div
        className={`shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-primary-light dark:text-slate-400 dark:group-hover:text-white'}`}
      >
        {icon}
      </div>
      {expanded && (
        <span
          className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-opacity duration-200 ${active ? 'text-white' : ''}`}
        >
          {label}
        </span>
      )}
      {active && !expanded && <div className="absolute left-0 w-1 h-6 bg-accent rounded-r-full" />}
    </button>
  );
}
