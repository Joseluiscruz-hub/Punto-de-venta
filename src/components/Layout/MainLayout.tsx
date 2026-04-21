import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import POSView from '../../views/POS/POSView';
import DashboardView from '../../views/Dashboard/DashboardView';
import InventoryView from '../../views/Inventory/InventoryView';
import SalesView from '../../views/Sales/SalesView';

export default function MainLayout() {
  const [currentView, setCurrentView] = useState<'pos' | 'dashboard' | 'inventory' | 'sales'>('pos');

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="flex-1 relative overflow-hidden h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full w-full"
          >
            {currentView === 'pos' && <POSView />}
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'inventory' && <InventoryView />}
            {currentView === 'sales' && <SalesView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
