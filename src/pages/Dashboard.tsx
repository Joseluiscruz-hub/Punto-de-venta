import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Banknote, PackageSearch, BarChart3, PieChart as PieIcon } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Sale, ProductView } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/theme-context';
import { formatCurrency, startOfPeriod, PERIOD_OPTIONS } from '../utils/helpers';
import { StatCard } from '../components/StatCard';

type SalesPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

interface ChartTooltipPayload {
  name?: string | number;
  value?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
}

const CustomTooltip = ({ active, payload }: ChartTooltipProps) => {
  const item = payload?.[0];
  if (active && item) {
    const value = Number(item.value ?? 0);
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{`${String(
          item.name ?? '',
        )}: ${formatCurrency(value)}`}</p>
      </div>
    );
  }

  return null;
};

export function DashboardView() {
  const { reqContext } = useAuth();
  const { isDark } = useAppTheme();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [period, setPeriod] = useState<SalesPeriod>('ALL');

  useEffect(() => {
    let active = true;
    const refreshDashboard = () => {
      Promise.all([
        BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }),
        BackendAPI.getStoreProducts(reqContext),
      ])
        .then(([salesData, productData]) => {
          if (!active) return;
          setSales(salesData);
          setProducts(productData);
        })
        .catch((error) => {
          if (active) console.error('No se pudo actualizar el dashboard', error);
        });
    };

    refreshDashboard();
    const interval = window.setInterval(refreshDashboard, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [reqContext]);

  const periodSales = useMemo(() => {
    const from = startOfPeriod(period);
    return sales.filter((sale) => new Date(sale.datetime).getTime() >= from);
  }, [sales, period]);

  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = periodSales.reduce(
    (sum, sale) => sum + (sale.items?.reduce((c, i) => c + i.cost * i.quantity, 0) || 0),
    0,
  );
  const totalProfit = totalRevenue - totalCost;
  const iv = products.reduce((sum, p) => sum + p.cost * p.stock, 0);

  const salesByDate = useMemo(() => {
    const groups: Record<string, number> = {};
    periodSales.forEach((s) => {
      const date = new Date(s.datetime).toLocaleDateString();
      groups[date] = (groups[date] || 0) + s.total;
    });
    return Object.entries(groups)
      .map(([date, total]) => ({ date, total }))
      .reverse();
  }, [periodSales]);

  const categoryMix = useMemo(() => {
    const cats: Record<string, number> = {};
    products.forEach((p) => {
      cats[p.category] = (cats[p.category] || 0) + p.stock * p.price;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [products]);

  const todayKey = new Date().toLocaleDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString();

  const todayRevenue = sales
    .filter((sale) => new Date(sale.datetime).toLocaleDateString() === todayKey)
    .reduce((sum, sale) => sum + sale.total, 0);

  const yesterdayRevenue = sales
    .filter((sale) => new Date(sale.datetime).toLocaleDateString() === yesterdayKey)
    .reduce((sum, sale) => sum + sale.total, 0);

  const revenueDelta =
    yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  return (
    <div className="view-shell p-4 sm:p-6 lg:p-10 h-full overflow-y-auto bg-[#f8fafc] dark:bg-slate-950 flex flex-col gap-6 lg:gap-8 transition-colors animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Panel de Control
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            Monitoreo de rendimiento empresarial en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key as SalesPeriod)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${period === option.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          icon={<Banknote size={24} />}
          title="Ventas de Hoy"
          value={formatCurrency(todayRevenue)}
          delta={revenueDelta}
        />
        <StatCard
          icon={<TrendingUp size={24} />}
          title="Ingresos del Periodo"
          value={formatCurrency(totalRevenue)}
        />
        <StatCard
          icon={<PieIcon size={24} />}
          title="Utilidad Estimada"
          value={formatCurrency(totalProfit)}
          suffix="MXN"
        />
        <StatCard
          icon={<PackageSearch size={24} />}
          title="Valor de Inventario"
          value={formatCurrency(iv)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-primary-light" />
              Curva de Ingresos
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ventas Totales
              </span>
            </div>
          </div>
          <div className="h-64 sm:h-72 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDate}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#1e293b' : '#f1f5f9'}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#2563eb"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="font-black text-lg text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-2">
            <PieIcon size={20} className="text-accent" />
            Mix de Inventario
          </h3>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryMix}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {categoryMix.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={['#0f172a', '#2563eb', '#06b6d4', '#10b981', '#f59e0b'][index % 5]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {categoryMix.slice(0, 4).map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#0f172a', '#2563eb', '#06b6d4', '#10b981', '#f59e0b'][
                        i % 5
                      ],
                    }}
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {cat.name}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {formatCurrency(cat.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
