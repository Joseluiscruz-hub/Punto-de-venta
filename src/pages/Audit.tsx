import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Filter, ShieldCheck } from 'lucide-react';
import type { AuditEvent } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import { downloadTextFile, errorMessage, escapeCsv } from '../utils/helpers';

const ACTION_OPTIONS = [
  '',
  'SHIFT_CLOSED',
  'CASH_IN',
  'CASH_OUT',
  'SALE_RETURNED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
];

export function AuditView() {
  const { reqContext, hasPermission } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!hasPermission(['ADMIN', 'MANAGER'])) {
      setError('No tienes permiso para consultar la auditoría.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await BackendAPI.getAuditEvents(reqContext, {
        action: action || undefined,
        entityType: entityType || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        q: q.trim() || undefined,
        limit: 500,
      });
      setEvents(rows);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cargar la auditoría'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [action, entityType, from, hasPermission, q, reqContext, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const entityTypes = useMemo(() => {
    const values = new Set(events.map((event) => event.entityType).filter(Boolean));
    return ['', ...Array.from(values).sort()];
  }, [events]);

  const exportCsv = () => {
    const header = [
      'Fecha',
      'Acción',
      'Entidad',
      'ID entidad',
      'Actor',
      'Sucursal',
      'IP',
      'Detalle',
    ];
    const lines = events.map((event) => [
      new Date(event.createdAt).toLocaleString('es-MX'),
      event.action,
      event.entityType,
      event.entityId ?? '',
      event.actorName ?? event.actorUserId ?? '',
      event.storeId ?? '',
      event.ipAddress ?? '',
      JSON.stringify(event.details ?? {}),
    ]);
    const csv = [header, ...lines].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    downloadTextFile(
      `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      String.fromCharCode(0xfeff) + csv,
      'text/csv;charset=utf-8;',
    );
  };

  return (
    <div className="view-shell view-page relative animate-fadeIn">
      <header className="view-header">
        <div className="min-w-0">
          <p className="section-kicker">Supervisión</p>
          <h1 className="view-title">Auditoría operativa</h1>
          <p className="view-description">
            Consulta eventos administrativos y financieros con filtros y exportación CSV.
          </p>
        </div>
        <Button
          onClick={exportCsv}
          disabled={!events.length}
          variant="secondary"
          icon={<Download size={17} />}
          className="gap-2 px-4"
        >
          Exportar CSV
        </Button>
      </header>

      <section className="data-panel">
        <div className="data-panel-header flex-wrap">
          <div className="flex items-center gap-3">
            <span className="icon-tile">
              <Filter size={18} />
            </span>
            <div>
              <p className="data-panel-title">Filtros</p>
              <p className="data-panel-subtitle">{events.length} eventos visibles</p>
            </div>
          </div>
          <Button onClick={() => void load()} variant="primary" className="px-4">
            Aplicar
          </Button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Acción
            <select
              className="input-premium p-2.5 text-sm font-semibold"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">Todas</option>
              {ACTION_OPTIONS.filter(Boolean).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Tipo de entidad
            <select
              className="input-premium p-2.5 text-sm font-semibold"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              {entityTypes.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value || 'Todas'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Desde
            <input
              type="date"
              className="input-premium p-2.5 text-sm font-semibold"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Hasta
            <input
              type="date"
              className="input-premium p-2.5 text-sm font-semibold"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
            Buscar
            <input
              className="input-premium p-2.5 text-sm font-semibold"
              placeholder="Actor, acción, detalle..."
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="data-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="data-panel-header">
          <div className="flex items-center gap-3">
            <span className="icon-tile">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="data-panel-title">Eventos registrados</p>
              <p className="data-panel-subtitle">Ordenados del más reciente al más antiguo</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
            Cargando auditoría…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-rose-600">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="sales-empty-state">
            <span>
              <ShieldCheck size={22} />
            </span>
            <strong>Sin eventos para estos filtros</strong>
            <p>Ajusta el rango o la acción para ver el historial de auditoría.</p>
          </div>
        ) : (
          <div className="overflow-auto custom-scrollbar">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Actor</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString('es-MX')}
                    </td>
                    <td>
                      <span className="status-pill status-pill-warning">{event.action}</span>
                    </td>
                    <td>{event.actorName ?? event.actorUserId ?? '—'}</td>
                    <td>
                      <p className="font-bold">{event.entityType}</p>
                      <p className="font-mono text-[10px] text-slate-400">{event.entityId}</p>
                    </td>
                    <td className="max-w-md truncate text-[11px] text-slate-500">
                      {JSON.stringify(event.details ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
