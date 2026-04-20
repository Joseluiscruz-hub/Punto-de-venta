import React from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon} <span className="font-medium text-sm">{label}</span>
    </button>
  );
}
