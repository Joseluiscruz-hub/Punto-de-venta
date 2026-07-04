import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';
import { RequestContext, ProcessSaleInput } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { hasFeature } from '../utils/helpers';

interface OfflineSaleRecord {
  saleId: string;
  reqContext: RequestContext;
  saleData: ProcessSaleInput;
}

function readOfflineSales(): OfflineSaleRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('offline_sales') ?? '[]');
    return Array.isArray(parsed) ? (parsed as OfflineSaleRecord[]) : [];
  } catch {
    localStorage.setItem('offline_sales', '[]');
    return [];
  }
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
      for (const record of currentOffline) {
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
      localStorage.setItem('offline_sales', JSON.stringify(failed));
      setPendingCount(failed.length);
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
      void syncSales();
    };
    const handleOffline = () => setIsOnline(false);
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 5000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
          Conexión Interrumpida. Modo Reserva ERP Activo.{' '}
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
