import React from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`
        nav-link group relative flex h-11 w-full items-center gap-3 px-3 transition-colors duration-150
        ${
          active
            ? 'nav-link-active text-slate-950 dark:text-white'
            : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
        }
      `}
    >
      <div
        className={`shrink-0 ${active ? 'text-primary' : 'text-slate-500 group-hover:text-primary-light'}`}
      >
        {icon}
      </div>
      <span className="truncate text-sm font-semibold">{label}</span>
    </button>
  );
}
