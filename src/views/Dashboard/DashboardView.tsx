import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';
import { TrendingUp, Package, AlertCircle, ShoppingBag } from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import GlassCard from '../../components/common/GlassCard';
import { formatCurrency } from '../../utils/formatters';

export default function DashboardView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    BackendAPI.getStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-800">Panel de Control</h2>
        <p className="text-slate-500 font-medium">Resumen ejecutivo del estado del negocio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={<TrendingUp className="text-emerald-500" />} 
          label="Ventas Totales" 
          value={formatCurrency(stats.totalSales)} 
          trend="+12.5%" 
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<ShoppingBag className="text-primary-500" />} 
          label="Transacciones" 
          value={stats.salesCount} 
          trend="+3 hoy" 
          color="bg-primary-50"
        />
        <StatCard 
          icon={<Package className="text-blue-500" />} 
          label="Productos" 
          value={stats.totalProducts} 
          trend="Activos" 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<AlertCircle className="text-rose-500" />} 
          label="Stock Crítico" 
          value={stats.lowStockCount} 
          trend={stats.lowStockCount > 0 ? "Requiere acción" : "Todo bien"} 
          color="bg-rose-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Tendencia de Ventas (Últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={stats.salesByDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 12}} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#64748b', fontSize: 12}}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val: number) => [formatCurrency(val), 'Ventas']}
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#8b5cf6" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, fill: '#8b5cf6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución de Inventario</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Stock Saludable', value: stats.totalProducts - stats.lowStockCount },
                  { name: 'Bajo Stock', value: stats.lowStockCount },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#f43f5e" />
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
             <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
               <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Saludable
             </div>
             <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
               <div className="w-3 h-3 rounded-full bg-rose-500"></div> Crítico
             </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: any) {
  return (
    <GlassCard className="flex flex-col gap-4">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <h4 className="text-2xl font-black text-slate-800 mt-1">{value}</h4>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trend.includes('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {trend}
        </span>
      </div>
    </GlassCard>
  );
}
