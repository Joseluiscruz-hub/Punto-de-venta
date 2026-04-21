import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendAPI } from '../../api/backend';

export default function SyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar cola cada 10 segundos
    const interval = setInterval(checkPendingQueue, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncOfflineSales();
    }
    setShowStatus(true);
    const timer = setTimeout(() => setShowStatus(false), 5000);
    return () => clearTimeout(timer);
  }, [isOnline]);

  const checkPendingQueue = async () => {
    const queue = await BackendAPI.getOfflineQueue();
    setPendingCount(queue.length);
  };

  const syncOfflineSales = async () => {
    const queue = await BackendAPI.getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      for (const sale of queue) {
        await BackendAPI.processSale({
          ...sale,
          isOfflineSync: true
        });
      }
      await BackendAPI.clearOfflineQueue();
      setPendingCount(0);
    } catch (error) {
      console.error('Error sincronizando ventas offline:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-amber-500/30 flex items-center gap-3 border border-amber-400 pointer-events-auto"
          >
            <RefreshCcw size={18} className={isSyncing ? 'animate-spin' : ''} />
            <span className="text-xs font-black uppercase tracking-wider">
              {isSyncing ? 'Sincronizando...' : `${pendingCount} Ventas pendientes`}
            </span>
          </motion.div>
        )}

        {showStatus && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 border pointer-events-auto ${
              isOnline 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi size={18} className="text-emerald-300" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Estado</span>
                  <span className="text-xs font-bold leading-tight">En Línea</span>
                </div>
                <CheckCircle2 size={16} className="text-emerald-300 ml-1" />
              </>
            ) : (
              <>
                <WifiOff size={18} className="text-rose-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Estado</span>
                  <span className="text-xs font-bold leading-tight">Modo Offline</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
