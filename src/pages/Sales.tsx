import { useState, useEffect, useMemo } from 'react';
import { Search, Download, CalendarDays, Printer, X, QrCode } from 'lucide-react';
import { Sale, PaymentMethod } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  normalizeText,
  startOfPeriod,
  PERIOD_OPTIONS,
  formatCurrency,
  escapeCsv,
  downloadTextFile,
} from '../utils/helpers';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

type SalesPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export function SalesView() {
  const { reqContext, store } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 140);
  const [period, setPeriod] = useState<SalesPeriod>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  useEffect(() => {
    BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(
      setSales,
    );
  }, [reqContext]);

  const filtered = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    const from = startOfPeriod(period);
    return sales.filter((sale) => {
      const inPeriod = new Date(sale.datetime).getTime() >= from;
      const inMethod = methodFilter === 'ALL' || sale.paymentMethod === methodFilter;
      const matchesQuery =
        !query ||
        sale.id.toLowerCase().includes(query) ||
        normalizeText(PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod).includes(query) ||
        (sale.items?.some((item) => normalizeText(item.name).includes(query)) ?? false);
      return inPeriod && inMethod && matchesQuery;
    });
  }, [sales, debouncedSearch, period, methodFilter]);

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, sale) => sum + sale.total, 0);
    const items = filtered.reduce((sum, sale) => sum + sale.itemsCount, 0);
    return {
      count: filtered.length,
      total,
      items,
      avg: filtered.length ? total / filtered.length : 0,
    };
  }, [filtered]);

  const methodOptions: Array<{ key: 'ALL' | PaymentMethod; label: string }> = [
    { key: 'ALL', label: 'Todos' },
    { key: 'CASH', label: 'Efectivo' },
    { key: 'CARD', label: 'Tarjeta' },
    { key: 'TRANSFER', label: 'Transferencia' },
  ];

  const exportCsv = () => {
    const header = ['ID', 'Fecha', 'Metodo', 'Articulos', 'Total', 'Recibido', 'Cambio'];
    const lines = filtered.map((sale) => [
      sale.id,
      new Date(sale.datetime).toLocaleString(),
      PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      sale.itemsCount,
      sale.total,
      sale.amountTendered,
      sale.changeAmount,
    ]);
    const csv = [header, ...lines].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    downloadTextFile(
      `ventas-${new Date().toISOString().slice(0, 10)}.csv`,
      String.fromCharCode(0xfeff) + csv,
      'text/csv;charset=utf-8;',
    );
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full flex flex-col text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      {selectedReceipt && (
        <ReceiptModal
          sale={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          storeName={store?.name ?? 'Sucursal'}
        />
      )}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 p-5 rounded-2xl shadow-sm">
        <div>
          <p className="section-kicker">Libro fiscal</p>
          <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white">
            Historico de Transacciones
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Filtra, revisa e imprime ventas con resumen del periodo.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!filtered.length}
          className="btn-secondary flex items-center justify-center gap-2 px-4 py-3 text-xs"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
        <div className="mini-metric">
          <p>Transacciones</p>
          <strong>{summary.count}</strong>
        </div>
        <div className="mini-metric">
          <p>Ingreso del periodo</p>
          <strong>{formatCurrency(summary.total)}</strong>
        </div>
        <div className="mini-metric">
          <p>Ticket promedio</p>
          <strong>{formatCurrency(summary.avg)}</strong>
        </div>
        <div className="mini-metric">
          <p>Articulos vendidos</p>
          <strong>{summary.items}</strong>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex-1 overflow-hidden flex flex-col transition-colors shadow-sm min-h-0">
        <div className="p-3 sm:p-4 lg:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ticket, metodo o producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-light transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400 inline-flex items-center gap-1">
              <CalendarDays size={12} /> Periodo
            </span>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key as SalesPeriod)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${period === option.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                {option.label}
              </button>
            ))}
            <span className="mx-1 hidden sm:inline-block w-px h-4 bg-slate-300 dark:bg-slate-700" />
            {methodOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setMethodFilter(option.key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${methodFilter === option.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-[10px] sm:text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-4 sm:px-6 py-4">UUID TRANSACCIÓN</th>
                <th className="px-4 sm:px-6 py-4">MARCA DE TIEMPO</th>
                <th className="px-4 sm:px-6 py-4">MÉTODO PAGO</th>
                <th className="px-4 sm:px-6 py-4 text-right">VALOR NETO</th>
                <th className="px-4 sm:px-6 py-4 text-center">UM</th>
                <th className="px-4 sm:px-6 py-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-primary/5 transition-colors text-slate-700 dark:text-slate-300"
                >
                  <td className="px-4 sm:px-6 py-4 font-mono text-slate-500 text-[10px]">{s.id}</td>
                  <td className="px-4 sm:px-6 py-4 font-semibold">
                    {new Date(s.datetime).toLocaleString()}
                  </td>
                  <td className="px-4 sm:px-6 py-4 font-bold text-primary-light uppercase tracking-tighter">
                    {PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(s.total)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center font-bold text-slate-500">
                    {s.itemsCount} LIN
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <button
                      onClick={() => setSelectedReceipt(s)}
                      className="p-2 text-primary-light hover:bg-primary/10 rounded-full transition-colors"
                    >
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 sm:px-6 py-20 text-center text-slate-400 font-medium italic"
                  >
                    No se encontraron registros coincidentes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({
  sale,
  onClose,
  storeName,
}: {
  sale: Sale;
  onClose: () => void;
  storeName: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-start mb-8">
          <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
            <QrCode size={24} />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-center mb-8">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white mb-1">
            {storeName}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Comprobante Simplificado de Venta
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">FECHA</span>
            <span className="text-slate-900 dark:text-white uppercase">
              {new Date(sale.datetime).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">ID TICKET</span>
            <span className="text-slate-900 dark:text-white font-mono">
              {sale.id.slice(0, 13).toUpperCase()}
            </span>
          </div>
          <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-4 mt-4">
            {sale.items?.map((item) => (
              <div key={item.id} className="flex justify-between mb-2">
                <div className="flex-1 pr-4">
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {item.quantity} x {formatCurrency(item.price)}
                  </p>
                </div>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">
                  {formatCurrency(item.subtotal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-700 mb-8">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Pagado
            </p>
            <h2 className="text-3xl font-black text-primary-light tracking-tighter tabular-nums">
              {formatCurrency(sale.total)}
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20"
        >
          Imprimir Copia
        </button>
      </div>
    </div>
  );
}
