import React from 'react';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  delta?: number | null;
  suffix?: string;
}

export function StatCard({ icon, title, value, delta, suffix }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
          {icon}
        </div>
        {delta !== undefined && delta !== null && (
          <div
            className={`text-xs font-bold flex items-center gap-1 ${delta >= 0 ? 'text-success' : 'text-error'}`}
          >
            <TrendingUp size={12} className={delta >= 0 ? '' : 'rotate-180'} />
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {value}
          </h3>
          {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
