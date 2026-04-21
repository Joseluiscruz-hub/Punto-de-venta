import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import POSView from '../../views/POS/POSView';
import DashboardView from '../../views/Dashboard/DashboardView';
import InventoryView from '../../views/Inventory/InventoryView';
import SalesView from '../../views/Sales/SalesView';
import SyncManager from '../common/SyncManager';

export type ViewType = 'pos' | 'dashboard' | 'inventory' | 'sales' | 'purchases' | 'clients' | 'prices' | 'reports' | 'config';

export default function MainLayout() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  return (
    <div className="flex h-screen w-full bg-bg text-text-strong overflow-hidden font-sans">
      {/* Sidebar Enterprise */}
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-screen">
        {/* Topbar Superior */}
        <Topbar />
        
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {currentView === 'dashboard' && <DashboardView />}
              {currentView === 'pos' && <POSView />}
              {currentView === 'inventory' && <InventoryView />}
              {currentView === 'sales' && <SalesView />}
              
              {/* Vistas en construcción */}
              {['purchases', 'clients', 'prices', 'reports', 'config'].includes(currentView) && (
                <div className="h-full flex items-center justify-center text-text-secondary opacity-30 flex-col gap-4">
                   <div className="w-12 h-12 border-2 border-current rounded-xl animate-pulse"></div>
                   <span className="font-black uppercase tracking-[0.3em] text-xs">Módulo en Desarrollo</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SyncManager />
    </div>
  );
}
