import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';
import { RequestContext, ProcessSaleInput } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { hasFeature, SALES_UPDATED_EVENT } from '../utils/helpers';
import {
  OFFLINE_SALES_CHANGED,
  reconcileOfflineSales,
  readOfflineSales,
} from '../data/offlineSalesQueue';

interface OfflineSaleRecord {
  saleId: string;
  reqContext: RequestContext;
  saleData: ProcessSaleInput;
}

export function SyncManager() {
  const { tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => readOfflineSales().length);
  const syncingRef = useRef(false);

  const syncSales = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const failed: OfflineSaleRecord[] = [];
      const currentOffline = readOfflineSales();
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
    const handleQueueChanged = () => setPendingCount(readOfflineSales().length);
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 5000);

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
      <div className="bg-rose-600 text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
        <WifiOff size={14} className="animate-pulse" />
        <span>
          ConexiÃ³n Interrumpida. Modo Reserva ERP Activo.{' '}
          {pendingCount > 0 ? `(${pendingCount} transacciones en cola)` : ''}
        </span>
      </div>
    );
  }

  if (isOnline && isSyncing) {
    return (
      <div className="bg-primary-light text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md z-50">
        <CloudUpload size={14} className="animate-pulse" />
        <span>Sincronizando transacciones con el Sistema Central SAP...</span>
      </div>
    );
  }

  return null;
}
