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
    <section className="metric-card animate-fadeIn p-5" aria-label={title}>
      <div className="mb-5 flex items-center justify-between">
        <div className="icon-tile">{icon}</div>
        {delta !== undefined && delta !== null && (
          <div
            className={`status-pill ${
              delta >= 0 ? 'status-pill-success' : 'status-pill-danger'
            } flex items-center gap-1`}
            title="Variación contra ayer"
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
    </section>
  );
}
