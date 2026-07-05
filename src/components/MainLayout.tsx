import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  Users,
  Receipt,
  History,
  Wallet,
  Store as StoreIcon,
  LogOut,
  Search,
  Menu,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BackendAPI } from '../data/backend';
import { Shift } from '../models/types';
import { NavItem } from './NavItem';
import { ThemeToggle } from './ThemeToggle';
import { SyncManager } from './SyncManager';

// Views
import { POSView } from '../pages/POS';
import { DashboardView } from '../pages/Dashboard';
import { InventoryView } from '../pages/Inventory';
import { SalesView } from '../pages/Sales';
import { MovementsView } from '../pages/Movements';
import { CorteCajaView, OpenShiftModal } from '../pages/CorteCaja';
import { ClientsView } from '../pages/Clients';

type View = 'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements' | 'corte' | 'clients';

export function MainLayout() {
  const { user, store, logout, hasPermission, reqContext } = useAuth();
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);

  useEffect(() => {
    BackendAPI.getActiveShift(reqContext).then((shift) => {
      if (!shift) setShowOpenShiftModal(true);
      else setActiveShift(shift);
    });
  }, [reqContext]);

  const navItemClick = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-bg flex h-screen font-sans text-slate-900 dark:text-[#E2E8F0] overflow-hidden transition-colors relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`
          side-rail fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out
          ${isSidebarExpanded ? 'w-64' : 'w-20'}
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static
        `}
      >
        <div
          className={`p-4 h-20 flex items-center ${isSidebarExpanded ? 'px-6' : 'justify-center'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <StoreIcon size={20} />
            </div>
            {isSidebarExpanded && (
              <div className="overflow-hidden transition-all duration-300">
                <h1 className="text-sm font-bold tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                  EL TRIUNFO
                </h1>
                <p className="text-[10px] text-primary-light font-semibold uppercase tracking-wider mt-1">
                  SaaS Retail
                </p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={currentView === 'dashboard'}
            onClick={() => navItemClick('dashboard')}
            expanded={isSidebarExpanded}
          />
          <NavItem
            icon={<ShoppingCart size={20} />}
            label="Ventas"
            active={currentView === 'pos'}
            onClick={() => navItemClick('pos')}
            expanded={isSidebarExpanded}
          />
          <NavItem
            icon={<PackageSearch size={20} />}
            label="Inventario"
            active={currentView === 'inventory'}
            onClick={() => navItemClick('inventory')}
            expanded={isSidebarExpanded}
          />
          <NavItem
            icon={<Users size={20} />}
            label="Clientes"
            active={currentView === 'clients'}
            onClick={() => navItemClick('clients')}
            expanded={isSidebarExpanded}
          />

          <div className={`my-4 border-t border-slate-100 dark:border-slate-800 mx-2`} />

          {hasPermission(['ADMIN', 'MANAGER']) && (
            <>
              <NavItem
                icon={<Receipt size={20} />}
                label="Reportes"
                active={currentView === 'sales'}
                onClick={() => navItemClick('sales')}
                expanded={isSidebarExpanded}
              />
              <NavItem
                icon={<History size={20} />}
                label="Auditoría"
                active={currentView === 'movements'}
                onClick={() => navItemClick('movements')}
                expanded={isSidebarExpanded}
              />
            </>
          )}

          <NavItem
            icon={<Wallet size={20} />}
            label="Configuración"
            active={currentView === 'corte'}
            onClick={() => navItemClick('corte')}
            expanded={isSidebarExpanded}
          />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100/70 dark:border-slate-800/70">
          <button
            onClick={logout}
            className={`btn-secondary flex items-center h-12 w-full ${isSidebarExpanded ? 'px-4 gap-4' : 'justify-center'}`}
          >
            <LogOut size={20} />
            {isSidebarExpanded && <span className="text-sm font-semibold">Salir</span>}
          </button>

          <div
            className={`mt-4 flex items-center ${isSidebarExpanded ? 'gap-3 px-2' : 'justify-center'}`}
          >
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary-light to-accent flex items-center justify-center text-white shrink-0 shadow-sm">
              <span className="text-[10px] font-bold">{user?.name?.[0].toUpperCase()}</span>
            </div>
            {isSidebarExpanded && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">{user?.role}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="main-canvas flex-1 flex flex-col min-w-0 transition-colors">
        <SyncManager />
        <div className="hidden lg:flex items-center justify-between px-8 py-4 top-command-strip">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-label text-slate-400">
                Colaborador
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            <div>
              <p className="text-label text-slate-400">
                Sucursal
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{store?.name}</p>
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            <div>
              <p className="text-label text-slate-400">
                Terminal
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Caja Principal</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar en el sistema..."
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm w-64 focus:ring-2 focus:ring-primary-light transition-all outline-none"
              />
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
                <p className="text-caption text-primary-light mt-1">
                {time.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              EL TRIUNFO
            </h1>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-hidden relative">
          {currentView === 'pos' && <POSView />}
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'sales' && <SalesView />}
          {currentView === 'movements' && <MovementsView />}
          {currentView === 'corte' && (
            <CorteCajaView
              onShiftClosed={() => {
                setActiveShift(null);
                setShowOpenShiftModal(true);
                setCurrentView('pos');
              }}
            />
          )}
          {currentView === 'clients' && <ClientsView />}
        </div>
        {showOpenShiftModal && (
          <OpenShiftModal
            onOpen={(shift) => {
              setActiveShift(shift);
              setShowOpenShiftModal(false);
            }}
          />
        )}
      </main>
    </div>
  );
}
