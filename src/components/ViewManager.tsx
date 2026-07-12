import { lazy, Suspense } from 'react';
import type { View } from '../models/types';

const POSView = lazy(() => import('../pages/POS').then((module) => ({ default: module.POSView })));
const DashboardView = lazy(() =>
  import('../pages/Dashboard').then((module) => ({ default: module.DashboardView })),
);
const InventoryView = lazy(() =>
  import('../pages/Inventory').then((module) => ({ default: module.InventoryView })),
);
const SalesView = lazy(() =>
  import('../pages/Sales').then((module) => ({ default: module.SalesView })),
);
const MovementsView = lazy(() =>
  import('../pages/Movements').then((module) => ({ default: module.MovementsView })),
);
const CorteCajaView = lazy(() =>
  import('../pages/CorteCaja').then((module) => ({ default: module.CorteCajaView })),
);
const ClientsView = lazy(() =>
  import('../pages/Clients').then((module) => ({ default: module.ClientsView })),
);

interface ViewManagerProps {
  currentView: View;
  onShiftClosed: () => void;
}

function ViewFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[#f8fafc] dark:bg-slate-950">
      <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export function ViewManager({ currentView, onShiftClosed }: ViewManagerProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden relative">
      <Suspense fallback={<ViewFallback />}>
        {currentView === 'pos' && <POSView />}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'sales' && <SalesView />}
        {currentView === 'movements' && <MovementsView />}
        {currentView === 'corte' && <CorteCajaView onShiftClosed={onShiftClosed} />}
        {currentView === 'clients' && <ClientsView />}
      </Suspense>
    </div>
  );
}
