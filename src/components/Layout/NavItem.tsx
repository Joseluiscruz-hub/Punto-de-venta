import React from 'react';
import { motion } from 'framer-motion';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all relative group ${
        active 
          ? 'text-white' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 bg-primary-600 rounded-xl shadow-lg shadow-primary-600/30"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 font-medium">{label}</span>
      
      {!active && (
        <div className="absolute left-0 w-1 h-0 bg-primary-500 rounded-full group-hover:h-6 transition-all duration-300" />
      )}
    </button>
  );
}
