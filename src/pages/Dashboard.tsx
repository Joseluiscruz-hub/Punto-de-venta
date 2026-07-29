import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  PackageSearch,
  PieChart as PieIcon,
  Receipt,
  TrendingUp,
} from 'lucide-react';
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
import { useAppTheme } from '../contexts/ThemeContext';
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

const CHART_COLORS = ['#0070b2', '#2563eb', '#0f766e', '#c79a45', '#64748b'];

const CustomTooltip = ({ active, payload }: ChartTooltipProps) => {
  const item = payload?.[0];
  if (!active || !item) return null;

  const value = Number(item.value ?? 0);
  return (
    <div className="chart-tooltip">
      <p className="text-xs font-extrabold">{String(item.name ?? '')}</p>
      <p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
};

export function DashboardView() {
  const { reqContext } = useAuth();
  const { isDark } = useAppTheme();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [period, setPeriod] = useState<SalesPeriod>('ALL');
  const [isLoading, setIsLoading] = useState(true);

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
        })
        .finally(() => {
          if (active) setIsLoading(false);
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

  const totalRevenue = periodSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalCost = periodSales.reduce(
    (sum, sale) =>
      sum + (sale.items?.reduce((cost, item) => cost + item.cost * item.quantity, 0) || 0),
    0,
  );
  const totalProfit = totalRevenue - totalCost;
  const inventoryValue = products.reduce((sum, product) => sum + product.cost * product.stock, 0);
  const lowStockCount = products.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock,
  ).length;
  const averageTicket = periodSales.length > 0 ? totalRevenue / periodSales.length : 0;

  const salesByDate = useMemo(() => {
    const groups: Record<string, number> = {};
    periodSales.forEach((sale) => {
      const date = new Date(sale.datetime).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
      });
      groups[date] = (groups[date] || 0) + sale.total;
    });
    return Object.entries(groups).map(([date, total]) => ({ date, total }));
  }, [periodSales]);

  const categoryMix = useMemo(() => {
    const categories: Record<string, number> = {};
    products.forEach((product) => {
      categories[product.category] =
        (categories[product.category] || 0) + product.stock * product.price;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
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
    <div className="view-shell view-page animate-fadeIn">
      <header className="view-header">
        <div className="min-w-0">
          <p className="section-kicker">Dirección comercial</p>
          <h1 className="view-title">Resumen ejecutivo</h1>
          <p className="view-description">
            Indicadores de ventas, rentabilidad e inventario para operar la tienda con contexto.
          </p>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Periodo de ventas">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={period === option.key}
              onClick={() => setPeriod(option.key as SalesPeriod)}
              className={`segmented-option ${
                period === option.key ? 'segmented-option-active' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Banknote size={21} />}
          title="Ventas de hoy"
          value={formatCurrency(todayRevenue)}
          delta={revenueDelta}
        />
        <StatCard
          icon={<TrendingUp size={21} />}
          title="Ingresos del periodo"
          value={formatCurrency(totalRevenue)}
        />
        <StatCard
          icon={<Receipt size={21} />}
          title="Ticket promedio"
          value={formatCurrency(averageTicket)}
        />
        <StatCard
          icon={<PackageSearch size={21} />}
          title="Valor de inventario"
          value={formatCurrency(inventoryValue)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="mini-metric">
          <p>Utilidad estimada</p>
          <strong>{formatCurrency(totalProfit)}</strong>
        </div>
        <div className="mini-metric">
          <p>Ventas en periodo</p>
          <strong>{periodSales.length} tickets</strong>
        </div>
        <div className="mini-metric">
          <p>Productos activos</p>
          <strong>{products.length} SKUs</strong>
        </div>
        <div className="mini-metric">
          <p>Alertas de inventario</p>
          <strong className={lowStockCount > 0 ? 'text-amber-600' : ''}>
            {lowStockCount} productos
          </strong>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="data-panel xl:col-span-2">
          <div className="data-panel-header">
            <div className="min-w-0">
              <h2 className="data-panel-title flex items-center gap-2">
                <BarChart3 size={19} className="text-primary" />
                Ingresos por día
              </h2>
              <p className="data-panel-subtitle">Ventas acumuladas dentro del periodo elegido</p>
            </div>
            <span className="status-pill status-pill-success">Actualiza cada minuto</span>
          </div>
          <div className="h-72 p-4 sm:h-80">
            {isLoading ? (
              <div className="skeleton-card h-full min-h-0" />
            ) : salesByDate.length === 0 ? (
              <EmptyChart message="Aún no hay ventas para este periodo." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByDate} margin={{ left: 4, right: 12, top: 14, bottom: 4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? '#26322f' : '#dfe7e4'}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                    tickFormatter={(value) => `$${value}`}
                    width={64}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Ingresos"
                    stroke="#0070b2"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0070b2', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="data-panel">
          <div className="data-panel-header">
            <div className="min-w-0">
              <h2 className="data-panel-title flex items-center gap-2">
                <PieIcon size={19} className="text-primary" />
                Mix de inventario
              </h2>
              <p className="data-panel-subtitle">Valor de venta por categoría</p>
            </div>
          </div>
          <div className="h-60 p-4">
            {categoryMix.length === 0 ? (
              <EmptyChart message="Sin inventario registrado." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryMix}
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryMix.map((category, index) => (
                      <Cell key={category.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-3 border-t border-[var(--ui-border)] p-4">
            {categoryMix.slice(0, 5).map((category, index) => (
              <div key={category.name} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                    {category.name}
                  </span>
                </div>
                <span className="text-xs font-extrabold tabular-nums text-slate-950 dark:text-white">
                  {formatCurrency(category.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {lowStockCount > 0 && (
        <aside className="data-panel flex items-start gap-3 p-4">
          <span className="icon-tile text-amber-700">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="data-panel-title">Inventario requiere atención</h2>
            <p className="data-panel-subtitle">
              Hay {lowStockCount} productos por debajo de su mínimo. Revisa compras o ajustes antes
              del siguiente pico de venta.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span className="empty-icon">
        <BarChart3 size={24} />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  );
}
