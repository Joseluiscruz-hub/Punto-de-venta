import {
  Crown,
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
  isOpen: boolean;
  onNavItemClick: (view: View) => void;
  onRequestClose: () => void;
}

export function Sidebar({ currentView, isOpen, onNavItemClick, onRequestClose }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();

  return (
    <aside
      className={`
        side-rail fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col transition-transform duration-200
        ${isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}
        2xl:static 2xl:w-64 2xl:translate-x-0 2xl:pointer-events-auto
      `}
    >
      <div className="flex h-20 items-center gap-3 border-b border-slate-200/80 px-5 dark:border-slate-800">
        <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center">
          <Crown size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-extrabold text-slate-950 dark:text-white">
            El Triunfo
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Punto de venta
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5 custom-scrollbar">
        <p className="px-3 pb-2 text-xs font-bold text-slate-400">Operación</p>
        <NavItem
          icon={<LayoutDashboard size={20} />}
          label="Resumen"
          active={currentView === 'dashboard'}
          onClick={() => {
            onNavItemClick('dashboard');
            onRequestClose();
          }}
        />
        <NavItem
          icon={<ShoppingCart size={20} />}
          label="Punto de venta"
          active={currentView === 'pos'}
          onClick={() => {
            onNavItemClick('pos');
            onRequestClose();
          }}
        />
        <NavItem
          icon={<PackageSearch size={20} />}
          label="Inventario"
          active={currentView === 'inventory'}
          onClick={() => {
            onNavItemClick('inventory');
            onRequestClose();
          }}
        />
        <NavItem
          icon={<Users size={20} />}
          label="Clientes"
          active={currentView === 'clients'}
          onClick={() => {
            onNavItemClick('clients');
            onRequestClose();
          }}
        />

        <div className="mx-3 my-4 border-t border-slate-200 dark:border-slate-800" />

        {hasPermission(['ADMIN', 'MANAGER']) && (
          <>
            <p className="px-3 pb-2 text-xs font-bold text-slate-400">Control</p>
            <NavItem
              icon={<Receipt size={20} />}
              label="Ventas registradas"
              active={currentView === 'sales'}
              onClick={() => {
                onNavItemClick('sales');
                onRequestClose();
              }}
            />
            <NavItem
              icon={<History size={20} />}
              label="Movimientos"
              active={currentView === 'movements'}
              onClick={() => {
                onNavItemClick('movements');
                onRequestClose();
              }}
            />
          </>
        )}

        <NavItem
          icon={<Wallet size={20} />}
          label="Caja y turnos"
          active={currentView === 'corte'}
          onClick={() => {
            onNavItemClick('corte');
            onRequestClose();
          }}
        />
      </nav>

      <div className="mt-auto border-t border-slate-200/80 p-4 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="user-avatar flex h-9 w-9 shrink-0 items-center justify-center">
            <span className="text-xs font-extrabold">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={() => {
            onRequestClose();
            logout();
          }}
          className="btn-secondary flex h-11 w-full items-center gap-3 px-4"
        >
          <LogOut size={18} />
          <span className="text-sm font-semibold">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
