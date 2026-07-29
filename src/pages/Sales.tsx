import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CircleDollarSign,
  Download,
  PackageCheck,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { Sale, PaymentMethod } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Button, Panel, SegmentedControl, TextInput } from '../components/ui';
import {
  normalizeText,
  startOfPeriod,
  PERIOD_OPTIONS,
  formatCurrency,
  escapeCsv,
  downloadTextFile,
  errorMessage,
  SALES_UPDATED_EVENT,
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await BackendAPI.getSales({
        tenantId: reqContext.tenantId,
        storeId: reqContext.storeId,
      });
      setSales(data);
    } catch (error) {
      setLoadError(errorMessage(error, 'No se pudieron cargar las ventas registradas.'));
    } finally {
      setIsLoading(false);
    }
  }, [reqContext]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void loadSales(), 0);
    const refreshSales = () => void loadSales();
    const refreshWhenVisible = () => {
      if (!document.hidden) void loadSales();
    };

    window.addEventListener(SALES_UPDATED_EVENT, refreshSales);
    window.addEventListener('online', refreshSales);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener(SALES_UPDATED_EVENT, refreshSales);
      window.removeEventListener('online', refreshSales);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadSales]);

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
    { key: 'MIXED', label: 'Mixto' },
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

  const showEmptyState =
    (isLoading && sales.length === 0) || Boolean(loadError) || filtered.length === 0;

  return (
    <div className="view-shell view-page relative animate-fadeIn">
      {selectedReceipt && (
        <ReceiptModal
          sale={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          storeName={store?.name ?? 'Sucursal'}
        />
      )}

      <header className="view-header">
        <div className="min-w-0">
          <p className="section-kicker">Control comercial</p>
          <h1 className="view-title">Ventas registradas</h1>
          <p className="view-description">
            Consulta transacciones, valida importes y recupera comprobantes de cada venta.
          </p>
        </div>
        <Button
          onClick={exportCsv}
          disabled={!filtered.length}
          variant="secondary"
          icon={<Download size={17} />}
          className="gap-2 px-4"
        >
          Exportar CSV
        </Button>
      </header>

      <section className="summary-grid" aria-label="Resumen de ventas filtradas">
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-brand">
            <ReceiptText size={19} />
          </span>
          <div>
            <p>Transacciones</p>
            <strong>{summary.count}</strong>
            <span>Ventas en la selección</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-success">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <p>Ingreso del periodo</p>
            <strong>{formatCurrency(summary.total)}</strong>
            <span>Total cobrado</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-neutral">
            <TrendingUp size={19} />
          </span>
          <div>
            <p>Ticket promedio</p>
            <strong>{formatCurrency(summary.avg)}</strong>
            <span>Promedio por venta</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-warning">
            <PackageCheck size={19} />
          </span>
          <div>
            <p>Artículos vendidos</p>
            <strong>{summary.items}</strong>
            <span>Unidades registradas</span>
          </div>
        </div>
      </section>

      <Panel className="flex min-h-[420px] flex-1 flex-col">
        <div className="data-panel-header sales-toolbar">
          <div className="min-w-0">
            <h2 className="data-panel-title">Historial de transacciones</h2>
            <p className="data-panel-subtitle">
              {filtered.length} de {sales.length} ventas visibles
            </p>
          </div>

          <div className="sales-toolbar-controls">
            <div className="sales-search">
              <TextInput
                type="text"
                aria-label="Buscar ventas"
                placeholder="Buscar ticket, método o producto"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leadingIcon={<Search size={18} />}
                className="h-11 w-full pr-4 text-sm font-semibold"
              />
            </div>
            <div className="sales-filter-groups">
              <div className="sales-filter-group">
                <span>Periodo</span>
                <SegmentedControl
                  ariaLabel="Periodo de ventas"
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={setPeriod}
                  className="sales-segmented-control"
                />
              </div>
              <div className="sales-filter-group">
                <span>Método de pago</span>
                <SegmentedControl
                  ariaLabel="Método de pago"
                  options={methodOptions}
                  value={methodFilter}
                  onChange={setMethodFilter}
                  className="sales-segmented-control"
                />
              </div>
            </div>
          </div>
        </div>

        {showEmptyState ? (
          <SalesEmptyState
            isLoading={isLoading}
            loadError={loadError}
            hasSales={sales.length > 0}
            onRetry={() => void loadSales()}
          />
        ) : (
          <>
            <div className="sales-card-list lg:hidden">
              {filtered.map((sale) => (
                <article key={sale.id} className="sale-record-card">
                  <div className="sale-record-card-header">
                    <div>
                      <p>Ticket</p>
                      <h3>#{shortTicketId(sale.id)}</h3>
                    </div>
                    <PaymentBadge method={sale.paymentMethod} />
                  </div>

                  <time dateTime={sale.datetime}>{formatSaleDate(sale.datetime)}</time>

                  <div className="sale-record-amount">
                    <span>Total cobrado</span>
                    <strong>{formatCurrency(sale.total)}</strong>
                  </div>

                  <div className="sale-record-card-footer">
                    <span>{sale.itemsCount} artículos</span>
                    <Button
                      variant="secondary"
                      icon={<Printer size={16} />}
                      onClick={() => setSelectedReceipt(sale)}
                      className="h-10 gap-2 px-3"
                    >
                      Comprobante
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden flex-1 overflow-auto custom-scrollbar lg:block">
              <table className="enterprise-table sales-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Fecha y hora</th>
                    <th>Método de pago</th>
                    <th className="text-center">Artículos</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <span className="sale-ticket">#{shortTicketId(sale.id)}</span>
                      </td>
                      <td className="font-semibold">{formatSaleDate(sale.datetime)}</td>
                      <td>
                        <PaymentBadge method={sale.paymentMethod} />
                      </td>
                      <td className="text-center font-bold text-slate-500">{sale.itemsCount}</td>
                      <td className="text-right font-bold text-slate-950 dark:text-white tabular-nums">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(sale)}
                          className="table-action-button"
                          aria-label={`Abrir comprobante ${shortTicketId(sale.id)}`}
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function shortTicketId(id: string) {
  return id.slice(-8).toUpperCase();
}

function formatSaleDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className={`payment-badge payment-badge-${method.toLowerCase()}`}>
      {PAYMENT_LABELS[method] ?? method}
    </span>
  );
}

function SalesEmptyState({
  isLoading,
  loadError,
  hasSales,
  onRetry,
}: {
  isLoading: boolean;
  loadError: string | null;
  hasSales: boolean;
  onRetry: () => void;
}) {
  const title = isLoading
    ? 'Cargando ventas'
    : loadError
      ? 'No fue posible cargar el historial'
      : hasSales
        ? 'Sin coincidencias'
        : 'Aún no hay ventas registradas';
  const description = isLoading
    ? 'Estamos recuperando las transacciones de la sucursal.'
    : loadError
      ? loadError
      : hasSales
        ? 'Prueba con otro ticket, método, producto o periodo.'
        : 'Las nuevas transacciones aparecerán aquí automáticamente.';

  return (
    <div className="sales-empty-state" role={isLoading ? 'status' : undefined}>
      <span>
        <ReceiptText size={24} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {loadError && (
        <Button variant="secondary" onClick={onRetry} className="mt-2 px-4">
          Reintentar
        </Button>
      )}
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
    <div className="receipt-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm animate-fadeIn sm:p-6">
      <section
        className="modal-card receipt-dialog flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="receipt-print-sheet custom-scrollbar overflow-y-auto p-5 sm:p-7">
          <div className="mb-7 flex items-start justify-between">
            <div className="receipt-brand-mark">
              <QrCode size={23} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="top-icon-button no-print"
              aria-label="Cerrar comprobante"
            >
              <X size={19} />
            </button>
          </div>

          <div className="mb-7 text-center">
            <h2
              id="receipt-title"
              className="text-base font-extrabold text-slate-950 dark:text-white"
            >
              {storeName}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Comprobante simplificado de venta
            </p>
          </div>

          <dl className="receipt-metadata">
            <div>
              <dt>Fecha</dt>
              <dd>{formatSaleDate(sale.datetime)}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd className="font-mono">#{shortTicketId(sale.id)}</dd>
            </div>
            <div>
              <dt>Forma de pago</dt>
              <dd>{PAYMENT_LABELS[sale.paymentMethod]}</dd>
            </div>
          </dl>

          <div className="receipt-items">
            <p className="receipt-items-title">Detalle de productos</p>
            {sale.items?.map((item) => (
              <div key={item.id} className="receipt-line-item">
                <div className="min-w-0 flex-1 pr-4">
                  <p>{item.name}</p>
                  <span>
                    {item.quantity} × {formatCurrency(item.price)}
                  </span>
                </div>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
            ))}
            {!sale.items?.length && (
              <p className="py-3 text-center text-xs text-slate-500">
                Sin detalle de productos disponible.
              </p>
            )}
          </div>

          <div className="receipt-total">
            <div>
              <p>Total pagado</p>
              <span>{sale.itemsCount} artículos</span>
            </div>
            <strong>{formatCurrency(sale.total)}</strong>
          </div>
        </div>

        <div className="receipt-actions no-print">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button
            variant="primary"
            icon={<Printer size={17} />}
            onClick={() => window.print()}
            className="flex-1 gap-2"
          >
            Imprimir copia
          </Button>
        </div>
      </section>
    </div>
  );
}
