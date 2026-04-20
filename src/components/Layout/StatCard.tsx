import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: string;
}

export default function StatCard({ icon, title, value, color }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${color} shadow-lg mb-4`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-3xl font-black text-slate-800">{value}</h4>
      </div>
    </div>
  );
}
