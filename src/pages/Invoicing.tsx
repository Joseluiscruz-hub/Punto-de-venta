import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, Receipt, RefreshCw } from 'lucide-react';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import type { InvoiceRecord, InvoiceStatus } from '../models/types';
import { Button, Panel, StatusBadge } from '../components/ui';
import { errorMessage, formatCurrency } from '../utils/helpers';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  NONE: 'Sin factura',
  PENDING_GLOBAL: 'Cola global',
  STAMPED: 'Timbrada',
  ERROR: 'Error',
  CREDIT_NOTE: 'Nota de crédito',
};

function toneFor(status: InvoiceStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'STAMPED') return 'success';
  if (status === 'PENDING_GLOBAL') return 'warning';
  if (status === 'ERROR') return 'danger';
  if (status === 'CREDIT_NOTE') return 'neutral';
  return 'neutral';
}

export function InvoicingView() {
  const { reqContext, hasPermission } = useAuth();
  const { addNotification } = useNotification();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const isAdmin = hasPermission(['ADMIN']);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await BackendAPI.listInvoices(reqContext);
      setInvoices(data);
    } catch (error) {
      addNotification(errorMessage(error, 'No se pudo cargar facturación'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, reqContext]);

  useEffect(() => {
    void load();
  }, [load]);

  const stampGlobal = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const result = await BackendAPI.stampGlobalInvoice(reqContext, period);
      addNotification(
        `Global ${period}: ${result.salesCount} ventas procesadas (${STATUS_LABEL[result.invoice.status]}).`,
        result.invoice.status === 'STAMPED' ? 'success' : 'warning',
      );
      await load();
    } catch (error) {
      addNotification(errorMessage(error, 'No se pudo timbrar la global'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-shell view-page relative animate-fadeIn">
      <header className="view-header">
        <div className="min-w-0">
          <p className="section-kicker">CFDI 4.0</p>
          <h1 className="view-title">Facturación</h1>
          <p className="view-description">
            Consulta UUID, PDF/XML del PAC y timbra la factura global mensual (Público en General).
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={() => void load()}
          className="gap-2 px-4"
        >
          Actualizar
        </Button>
      </header>

      {isAdmin && (
        <Panel className="mb-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Timbrar global del mes
              </h2>
              <p className="text-xs text-slate-500">
                Agrupa ventas en cola PENDING_GLOBAL (RFC XAXX010101000). Solo ADMIN.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="input-premium rounded-xl px-3 py-2 text-sm font-bold"
              />
              <Button
                onClick={() => void stampGlobal()}
                disabled={busy}
                icon={<Receipt size={16} />}
                className="gap-2 px-4"
              >
                Timbrar global
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <Panel className="flex min-h-[360px] flex-1 flex-col">
        <div className="data-panel-header">
          <div>
            <h2 className="data-panel-title">Comprobantes</h2>
            <p className="data-panel-subtitle">
              {loading ? 'Cargando…' : `${invoices.length} registros`}
            </p>
          </div>
        </div>

        {invoices.length === 0 && !loading ? (
          <div className="sales-empty-state">
            <span>
              <FileText size={24} />
            </span>
            <strong>Sin facturas todavía</strong>
            <p>Las ventas con RFC se timbran al cobrar; el resto entra a la cola global.</p>
          </div>
        ) : (
          <div className="overflow-auto custom-scrollbar">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>UUID</th>
                  <th>Periodo</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Archivos</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-bold">{invoice.kind}</td>
                    <td>
                      <StatusBadge tone={toneFor(invoice.status)}>
                        {STATUS_LABEL[invoice.status]}
                      </StatusBadge>
                      {invoice.error && (
                        <small className="mt-1 block max-w-xs truncate text-[0.65rem] text-rose-600">
                          {invoice.error}
                        </small>
                      )}
                    </td>
                    <td className="font-mono text-[0.7rem]">{invoice.uuid ?? '—'}</td>
                    <td>{invoice.globalPeriod ?? '—'}</td>
                    <td className="text-right tabular-nums">{formatCurrency(invoice.total)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.pdfUrl && (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="table-action-button"
                            title="PDF"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {invoice.xmlUrl && (
                          <a
                            href={invoice.xmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="table-action-button"
                            title="XML"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
