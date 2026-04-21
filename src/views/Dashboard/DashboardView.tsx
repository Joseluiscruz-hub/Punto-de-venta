import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import {
  TrendingUp, AlertCircle, ShoppingBag,
  ArrowDownRight, Clock, Target,
  Zap, ChevronRight, CheckSquare
} from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import type { Sale, Product } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';
import SurfaceCard from '../../components/common/GlassCard';

const [sales, setSales] = useState<Sale[]>([]);
const [products, setProducts] = useState<Product[]>([]);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setError(null);
  BackendAPI.getSales().then(setSales).catch(err => setError(err.message || 'Error al cargar ventas'));
  BackendAPI.getProducts().then(setProducts).catch(err => setError(err.message || 'Error al cargar productos'));
}, []);

if (error) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="bg-red-100 text-red-700 px-6 py-4 rounded shadow">
        <strong>Error:</strong> {error}
      </div>
      <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  );
}

const lowStockProducts = products.filter(p => p.stock <= p.minStock);
const todaySales = sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString());
const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
const avgTicket = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;

// KPI Row Data
const kpis = [
  { label: 'Ventas de hoy', value: formatCurrency(todayRevenue), delta: '+5.4%', trend: 'up', icon: <TrendingUp size={20} /> },
  { label: 'Ticket promedio', value: formatCurrency(avgTicket), delta: '+2.1%', trend: 'up', icon: <Target size={20} /> },
  { label: 'Margen bruto', value: '32.5%', delta: '-0.4%', trend: 'down', icon: <Zap size={20} /> },
  { label: 'Stock crítico', value: lowStockProducts.length, delta: lowStockProducts.length > 0 ? 'Riesgo' : 'OK', trend: lowStockProducts.length > 0 ? 'down' : 'up', icon: <AlertCircle size={20} /> },
  { label: 'Merma est.', value: formatCurrency(450), delta: '-12%', trend: 'up', icon: <ArrowDownRight size={20} /> },
  { label: 'Trans. por hora', value: (todaySales.length / 8).toFixed(1), delta: 'Estable', trend: 'up', icon: <Clock size={20} /> },
];

// Chart Data
const salesByHour = [
  { h: '08:00', t: 1200 }, { h: '10:00', t: 4500 }, { h: '12:00', t: 8900 },
  { h: '14:00', t: 6700 }, { h: '16:00', t: 11200 }, { h: '18:00', t: 9400 }
];

const categoryUtility = products.slice(0, 5).map(p => ({
  name: p.category,
  value: p.price - p.cost
}));

return (
  <div className="p-8 h-full overflow-y-auto custom-scrollbar space-y-8 bg-bg">

    {/* Fila 1: 6 KPIs */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, idx) => (
        <SurfaceCard key={idx} className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="text-text-secondary opacity-40">{kpi.icon}</div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${kpi.trend === 'up' ? 'text-success bg-success/10' : 'text-error bg-error/10'
              }`}>
              {kpi.delta}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-xl font-black text-text-strong tracking-tight">{kpi.value}</p>
          </div>
        </SurfaceCard>
      ))}
    </div>

    {/* Fila 2: Gráficas */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SurfaceCard className="p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Ventas por hora (Proyectado)</h3>
          <button className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">Ver Reporte <ChevronRight size={12} /></button>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesByHour}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{ fill: '#9AA4B2', fontSize: 10, fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9AA4B2', fontSize: 10, fontWeight: 'bold' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#151922', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="t" stroke="#18B3A7" strokeWidth={3} dot={{ r: 4, fill: '#18B3A7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Utilidad por Categoría</h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryUtility} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#9AA4B2', fontSize: 10, fontWeight: 'bold' }} width={80} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#151922', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }} />
              <Bar dataKey="value" fill="#18B3A7" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SurfaceCard>
    </div>

    {/* Fila 3: Stock Crítico & Top Productos */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SurfaceCard className="p-6 lg:col-span-1">
        <h3 className="text-sm font-black uppercase tracking-widest text-text-strong mb-6 flex items-center gap-2">
          <AlertCircle size={16} className="text-alert" /> Stock Crítico
        </h3>
        <div className="space-y-4">
          {lowStockProducts.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                <div>
                  <p className="text-xs font-black text-text-strong">{p.name}</p>
                  <p className="text-[10px] font-bold text-text-secondary">{p.barcode}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-error">{p.stock} pza</p>
                <p className="text-[10px] font-bold text-text-secondary">Min: {p.minStock}</p>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6 lg:col-span-2 overflow-hidden">
        <h3 className="text-sm font-black uppercase tracking-widest text-text-strong mb-6">Actividad Reciente y Top Movimientos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="pb-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Operación</th>
                <th className="pb-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Origen</th>
                <th className="pb-4 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Monto</th>
                <th className="pb-4 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="group hover:bg-surface-2 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-text-secondary">
                        <ShoppingBag size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-strong">Venta Pos #{(824 + i)}</p>
                        <p className="text-[10px] font-bold text-text-secondary">Hace {i + 1} min</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-xs font-bold text-text-secondary">Sucursal Central</td>
                  <td className="py-4 text-right text-xs font-black text-text-strong">{formatCurrency(1200 + i * 450)}</td>
                  <td className="py-4 text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-success/10 text-success px-2 py-0.5 rounded-md">Completado</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>

    {/* Fila 4: Tareas Pendientes */}
    <SurfaceCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-text-strong flex items-center gap-2">
          <CheckSquare size={16} className="text-primary" /> Tareas Operativas Pendientes
        </h3>
        <span className="text-[10px] font-black bg-surface-2 text-text-secondary px-3 py-1 rounded-full border border-border-subtle">4 Pendientes</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { t: 'Arqueo de caja terminal 01', d: 'Prioridad Alta', c: 'border-l-error' },
          { t: 'Recepción de proveedor Sabritas', d: 'Programado 14:00', c: 'border-l-primary' },
          { t: 'Ajuste de inventario Lácteos', d: 'Auditoría mensual', c: 'border-l-alert' },
          { t: 'Actualización de precios Panadería', d: 'Cambio de temporada', c: 'border-l-text-secondary' },
        ].map((task, i) => (
          <div key={i} className={`p-4 rounded-xl bg-surface-2 border border-border-subtle border-l-4 ${task.c}`}>
            <p className="text-xs font-black text-text-strong mb-1">{task.t}</p>
            <p className="text-[10px] font-bold text-text-secondary">{task.d}</p>
          </div>
        ))}
      </div>
    </SurfaceCard>

  </div>
);
}
