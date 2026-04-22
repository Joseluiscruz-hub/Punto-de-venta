import { useState, useEffect } from 'react';
import { 
  BarChart3, Download, 
  TrendingUp, ShoppingCart, Users, DollarSign,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { BackendAPI } from '../../api/backend';
import type { Sale } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';
import SurfaceCard from '../../components/common/GlassCard';

export default function ReportsView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [timeRange, setTimeRange] = useState('Semanal');

  useEffect(() => {
    BackendAPI.getSales().then(setSales);
  }, []);

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
  
  // Datos para gráficos
  const chartData = [
    { name: 'Lun', sales: 12400, transactions: 45 },
    { name: 'Mar', sales: 15600, transactions: 52 },
    { name: 'Mie', sales: 13200, transactions: 48 },
    { name: 'Jue', sales: 18900, transactions: 65 },
    { name: 'Vie', sales: 24500, transactions: 88 },
    { name: 'Sab', sales: 31200, transactions: 112 },
    { name: 'Dom', sales: 22800, transactions: 74 },
  ];

  const categoryDistribution = [
    { name: 'Bebidas', value: 45 },
    { name: 'Botanas', value: 25 },
    { name: 'Lácteos', value: 15 },
    { name: 'Otros', value: 15 },
  ];

  const COLORS = ['#18B3A7', '#F59E0B', '#EF4444', '#22C55E'];

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-bg overflow-y-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
              <BarChart3 size={24} className="text-bg" />
            </div>
            <h1 className="text-3xl font-black text-text-strong tracking-tight uppercase">Inteligencia de Negocio</h1>
          </div>
          <p className="text-text-secondary font-medium">Analítica avanzada y reportes operativos de El Triunfo</p>
        </div>

        <div className="flex gap-3">
          <div className="flex bg-surface-1 border border-border-subtle rounded-xl p-1">
             {['Diario', 'Semanal', 'Mensual'].map(range => (
               <button 
                 key={range}
                 onClick={() => setTimeRange(range)}
                 className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-enterprise ${
                   timeRange === range ? 'bg-primary text-bg shadow-lg shadow-primary/20' : 'text-text-secondary hover:text-text-strong'
                 }`}
               >
                 {range}
               </button>
             ))}
          </div>
          <button className="flex items-center gap-2 px-6 bg-surface-1 border border-border-subtle text-text-strong font-black rounded-xl hover:border-primary transition-enterprise uppercase tracking-widest text-[10px]">
            <Download size={18} /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="text-text-secondary opacity-30"><DollarSign size={20} /></div>
             <div className="flex items-center gap-1 text-success text-[10px] font-black"><ArrowUpRight size={14} /> +15.2%</div>
          </div>
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Ingresos Brutos</p>
          <p className="text-2xl font-black text-text-strong tracking-tighter">{formatCurrency(totalSales)}</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="text-text-secondary opacity-30"><ShoppingCart size={20} /></div>
             <div className="flex items-center gap-1 text-success text-[10px] font-black"><ArrowUpRight size={14} /> +8.4%</div>
          </div>
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Artículos Vendidos</p>
          <p className="text-2xl font-black text-text-strong tracking-tighter">{totalItems}</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="text-text-secondary opacity-30"><Users size={20} /></div>
             <div className="flex items-center gap-1 text-error text-[10px] font-black"><ArrowDownRight size={14} /> -2.1%</div>
          </div>
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Clientes Únicos</p>
          <p className="text-2xl font-black text-text-strong tracking-tighter">142</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="text-text-secondary opacity-30"><TrendingUp size={20} /></div>
             <div className="flex items-center gap-1 text-success text-[10px] font-black"><ArrowUpRight size={14} /> +5.5%</div>
          </div>
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Margen de Operación</p>
          <p className="text-2xl font-black text-text-strong tracking-tighter">31.2%</p>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SurfaceCard className="p-8 lg:col-span-2">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Desempeño de Ingresos vs Transacciones</h3>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9AA4B2', fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9AA4B2', fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip contentStyle={{ backgroundColor: '#151922', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }} />
                    <Line type="monotone" dataKey="sales" stroke="#18B3A7" strokeWidth={4} dot={{ r: 6, fill: '#18B3A7', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="transactions" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B', strokeWidth: 0 }} strokeDasharray="5 5" />
                 </LineChart>
              </ResponsiveContainer>
           </div>
        </SurfaceCard>

        <SurfaceCard className="p-8">
           <h3 className="text-sm font-black uppercase tracking-widest text-text-strong mb-12">Mezcla de Ventas</h3>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {categoryDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#151922', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }} />
                 </PieChart>
              </ResponsiveContainer>
              <div className="mt-8 space-y-3">
                 {categoryDistribution.map((item, index) => {
                    return (
                      <div key={item.name} className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-[10px] font-bold text-text-secondary">{item.name}</span>
                         </div>
                         <span className="text-xs font-black text-text-strong">{item.value}%</span>
                      </div>
                    );
                 })}
              </div>
           </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
