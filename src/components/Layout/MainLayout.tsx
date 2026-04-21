import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import POSView from '../../views/POS/POSView';
import DashboardView from '../../views/Dashboard/DashboardView';
import InventoryView from '../../views/Inventory/InventoryView';
import SalesView from '../../views/Sales/SalesView';
import PurchasesView from '../../views/Purchases/PurchasesView';
import ClientsView from '../../views/Clients/ClientsView';
import PricesView from '../../views/Prices/PricesView';
import ReportsView from '../../views/Reports/ReportsView';
import ConfigView from '../../views/Config/ConfigView';
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
              {currentView === 'purchases' && <PurchasesView />}
              {currentView === 'clients' && <ClientsView />}
              {currentView === 'prices' && <PricesView />}
              {currentView === 'reports' && <ReportsView />}
              {currentView === 'config' && <ConfigView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <SyncManager />
    </div>
  );
}
