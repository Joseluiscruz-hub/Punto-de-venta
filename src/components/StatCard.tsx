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
    <div className="metric-card animate-fadeIn p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-primary dark:bg-emerald-950/50 dark:text-emerald-300">
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
        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</h3>
          {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
