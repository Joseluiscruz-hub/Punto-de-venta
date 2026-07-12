import { POSView } from '../pages/POS';
import { DashboardView } from '../pages/Dashboard';
import { InventoryView } from '../pages/Inventory';
import { SalesView } from '../pages/Sales';
import { MovementsView } from '../pages/Movements';
import { CorteCajaView } from '../pages/CorteCaja';
import { ClientsView } from '../pages/Clients';
import { View } from '../models/types';

interface ViewManagerProps {
  currentView: View;
  onShiftClosed: () => void;
}

export function ViewManager({ currentView, onShiftClosed }: ViewManagerProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden relative">
      {currentView === 'pos' && <POSView />}
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'sales' && <SalesView />}
      {currentView === 'movements' && <MovementsView />}
      {currentView === 'corte' && <CorteCajaView onShiftClosed={onShiftClosed} />}
      {currentView === 'clients' && <ClientsView />}
    </div>
  );
}