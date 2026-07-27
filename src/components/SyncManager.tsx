import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { hasFeature, SALES_UPDATED_EVENT } from '../utils/helpers';
import {
  OFFLINE_SALES_CHANGED,
  reconcileOfflineSales,
  readOfflineSales,
  type OfflineSaleRecord,
} from '../data/offlineSalesQueue';

export function SyncManager() {
  const { tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => readOfflineSales().length);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const syncSales = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const failed: OfflineSaleRecord[] = [];
      const currentOffline = readOfflineSales();
      if (currentOffline.length === 0) {
        setSyncError(null);
        return;
      }
      const attemptedIds = new Set<string>();
      for (const record of currentOffline) {
        attemptedIds.add(record.saleId);
        try {
          await BackendAPI.processSale(record.reqContext, {
            ...record.saleData,
            externalId: record.saleId,
          });
        } catch (error) {
          console.error('Error al sincronizar venta:', error);
          failed.push(record);
        }
      }
      const pending = reconcileOfflineSales(attemptedIds, failed);
      setPendingCount(pending.length);
      setSyncError(
        failed.length > 0
          ? `${failed.length} ${failed.length === 1 ? 'venta sigue pendiente' : 'ventas siguen pendientes'}.`
          : null,
      );
      if (attemptedIds.size > failed.length) {
        window.dispatchEvent(new Event(SALES_UPDATED_EVENT));
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const count = readOfflineSales().length;
      setPendingCount(count);
      if (navigator.onLine && count > 0 && hasFeature(tenant, 'OFFLINE')) void syncSales();
    };
    const handleOnline = () => {
      setIsOnline(true);
      if (hasFeature(tenant, 'OFFLINE')) void syncSales();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChanged = () => {
      const count = readOfflineSales().length;
      setPendingCount(count);
      if (count === 0) setSyncError(null);
    };
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30_000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_SALES_CHANGED, handleQueueChanged);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_SALES_CHANGED, handleQueueChanged);
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [syncSales, tenant]);

  if (!hasFeature(tenant, 'OFFLINE')) return null;

  if (!isOnline) {
    return (
      <div
        className="bg-rose-600 text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-sm z-50"
        role="status"
        aria-live="polite"
      >
        <WifiOff size={14} className="animate-pulse" />
        <span>
          Conexión Interrumpida. Modo Reserva ERP Activo.{' '}
          {pendingCount > 0 ? `(${pendingCount} transacciones en cola)` : ''}
        </span>
      </div>
    );
  }

  if (isOnline && isSyncing) {
    return (
      <div
        className="bg-primary-light text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md z-50"
        role="status"
        aria-live="polite"
      >
        <CloudUpload size={14} className="animate-pulse" />
        <span>Sincronizando transacciones con el Sistema Central SAP...</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        className="bg-amber-500 text-slate-950 text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-3 shadow-sm z-50"
        role="status"
        aria-live="polite"
      >
        <CloudUpload size={14} aria-hidden="true" />
        <span>
          {syncError ??
            `${pendingCount} ${pendingCount === 1 ? 'venta pendiente' : 'ventas pendientes'} de sincronizar.`}
        </span>
        <button
          type="button"
          onClick={() => void syncSales()}
          className="rounded-md border border-slate-950/30 px-2 py-0.5 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return null;
}
