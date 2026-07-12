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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NavItem } from './NavItem';
import { ThemeToggle } from './ThemeToggle';
import { View } from '../models/types';

interface SidebarProps {
  currentView: View;
  isExpanded: boolean;
  onNavItemClick: (view: View) => void;
  onToggleExpand: (isExpanded: boolean) => void;
}

export function Sidebar({
  currentView,
  isExpanded,
  onNavItemClick,
  onToggleExpand,
}: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();

  return (
    <aside
      onMouseEnter={() => onToggleExpand(true)}
      onMouseLeave={() => onToggleExpand(false)}
      className={`
        side-rail fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-64' : 'w-20'}
        lg:static
      `}
    >
      <div className={`p-4 h-20 flex items-center ${isExpanded ? 'px-6' : 'justify-center'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <StoreIcon size={20} />
          </div>
          {isExpanded && (
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
          onClick={() => onNavItemClick('dashboard')}
          expanded={isExpanded}
        />
        <NavItem
          icon={<ShoppingCart size={20} />}
          label="Ventas"
          active={currentView === 'pos'}
          onClick={() => onNavItemClick('pos')}
          expanded={isExpanded}
        />
        <NavItem
          icon={<PackageSearch size={20} />}
          label="Inventario"
          active={currentView === 'inventory'}
          onClick={() => onNavItemClick('inventory')}
          expanded={isExpanded}
        />
        <NavItem
          icon={<Users size={20} />}
          label="Clientes"
          active={currentView === 'clients'}
          onClick={() => onNavItemClick('clients')}
          expanded={isExpanded}
        />

        <div className={`my-4 border-t border-slate-100 dark:border-slate-800 mx-2`} />

        {hasPermission(['ADMIN', 'MANAGER']) && (
          <>
            <NavItem
              icon={<Receipt size={20} />}
              label="Reportes"
              active={currentView === 'sales'}
              onClick={() => onNavItemClick('sales')}
              expanded={isExpanded}
            />
            <NavItem
              icon={<History size={20} />}
              label="Auditoría"
              active={currentView === 'movements'}
              onClick={() => onNavItemClick('movements')}
              expanded={isExpanded}
            />
          </>
        )}

        <NavItem
          icon={<Wallet size={20} />}
          label="Configuración"
          active={currentView === 'corte'}
          onClick={() => onNavItemClick('corte')}
          expanded={isExpanded}
        />
      </nav>

      <div className="p-4 mt-auto border-t border-slate-100/70 dark:border-slate-800/70">
        <button
          onClick={logout}
          className={`btn-secondary flex items-center h-12 w-full ${isExpanded ? 'px-4 gap-4' : 'justify-center'}`}
        >
          <LogOut size={20} />
          {isExpanded && <span className="text-sm font-semibold">Salir</span>}
        </button>

        <div className={`mt-4 flex items-center ${isExpanded ? 'gap-3 px-2' : 'justify-center'}`}>
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary-light to-accent flex items-center justify-center text-white shrink-0 shadow-sm">
            <span className="text-[10px] font-bold">{user?.name?.[0].toUpperCase()}</span>
          </div>
          {isExpanded && (
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
  );
}