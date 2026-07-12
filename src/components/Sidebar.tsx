import {
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  Users,
  Receipt,
  History,
  Wallet,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NavItem } from './NavItem';
import { ThemeToggle } from './ThemeToggle';
import { View } from '../models/types';

interface SidebarProps {
  currentView: View;
  isExpanded: boolean;
  isOpen: boolean;
  onNavItemClick: (view: View) => void;
  onToggleExpand: (isExpanded: boolean) => void;
  onRequestClose: () => void;
}

export function Sidebar({
  currentView,
  isExpanded,
  isOpen,
  onNavItemClick,
  onToggleExpand,
  onRequestClose,
}: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();
  const logoSrc = `${import.meta.env.BASE_URL}el-triunfo-logo.png.png`;

  return (
    <aside
      onMouseEnter={() => onToggleExpand(true)}
      onMouseLeave={() => onToggleExpand(false)}
      className={`
        side-rail fixed inset-y-0 left-0 z-50 flex h-screen flex-col transition-all duration-300 ease-in-out
        w-72 lg:w-20 ${isExpanded ? 'lg:w-64' : ''}
        ${isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}
        lg:static lg:translate-x-0 lg:pointer-events-auto
      `}
    >
      <div className={`p-4 h-24 flex items-center ${isExpanded ? 'px-6' : 'justify-center'}`}>
        <div className="flex items-center gap-3 overflow-visible">
          <img
            src={logoSrc}
            alt="El Triunfo"
            className="w-12 h-12 shrink-0 object-contain"
          />
          {isExpanded && (
            <div className="overflow-hidden transition-all duration-300">
              <h1 className="text-sm font-bold tracking-tight uppercase text-slate-950 dark:text-white leading-none">
                EL TRIUNFO
              </h1>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider mt-1">
                Punto de Venta
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
          onClick={() => {
            onNavItemClick('dashboard');
            onRequestClose();
          }}
          expanded={isExpanded}
        />
        <NavItem
          icon={<ShoppingCart size={20} />}
          label="Ventas"
          active={currentView === 'pos'}
          onClick={() => {
            onNavItemClick('pos');
            onRequestClose();
          }}
          expanded={isExpanded}
        />
        <NavItem
          icon={<PackageSearch size={20} />}
          label="Inventario"
          active={currentView === 'inventory'}
          onClick={() => {
            onNavItemClick('inventory');
            onRequestClose();
          }}
          expanded={isExpanded}
        />
        <NavItem
          icon={<Users size={20} />}
          label="Clientes"
          active={currentView === 'clients'}
          onClick={() => {
            onNavItemClick('clients');
            onRequestClose();
          }}
          expanded={isExpanded}
        />

        <div className={`my-4 border-t border-slate-100 dark:border-slate-800 mx-2`} />

        {hasPermission(['ADMIN', 'MANAGER']) && (
          <>
            <NavItem
              icon={<Receipt size={20} />}
              label="Reportes"
              active={currentView === 'sales'}
              onClick={() => {
                onNavItemClick('sales');
                onRequestClose();
              }}
              expanded={isExpanded}
            />
            <NavItem
              icon={<History size={20} />}
              label="Auditoría"
              active={currentView === 'movements'}
              onClick={() => {
                onNavItemClick('movements');
                onRequestClose();
              }}
              expanded={isExpanded}
            />
          </>
        )}

        <NavItem
          icon={<Wallet size={20} />}
          label="Configuración"
          active={currentView === 'corte'}
          onClick={() => {
            onNavItemClick('corte');
            onRequestClose();
          }}
          expanded={isExpanded}
        />
      </nav>

      <div className="p-4 mt-auto border-t border-slate-100/70 dark:border-slate-800/70">
        <button
          onClick={() => {
            onRequestClose();
            logout();
          }}
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