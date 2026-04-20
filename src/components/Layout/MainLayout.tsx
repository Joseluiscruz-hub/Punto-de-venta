import React, { useState } from 'react';
import { ShoppingCart, LayoutDashboard, PackageSearch, History, LogOut, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import POSView from '../POS/POSView';
import InventoryView from '../Inventory/InventoryView';
import DashboardView from './DashboardView';
import SalesView from './SalesView';
import NavItem from './NavItem';

export default function MainLayout() {
  const { user, logout, hasPermission } = useAuth();
  const [currentView, setCurrentView] = useState<'pos' | 'dashboard' | 'inventory' | 'sales'>('pos');

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 text-white p-2 rounded-lg shadow-lg shadow-emerald-500/20">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">MiniSuper</h1>
            <p className="text-xs text-slate-400 font-medium">ERP & POS System</p>
          </div>
        </div>
        {/* Info Usuario */}
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-slate-700 p-2 rounded-full text-slate-300">
            {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-emerald-400" /> : <UserCog size={20} />}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{user?.role}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <NavItem icon={<ShoppingCart size={20} />} label="Terminal de Caja" active={currentView === 'pos'} onClick={() => setCurrentView('pos')} />
          {/* Rutas protegidas */}
          {hasPermission(['ADMIN', 'MANAGER']) && (
            <>
              <div className="pt-4 pb-2 px-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Administración</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Panel de Control" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
              <NavItem icon={<PackageSearch size={20} />} label="Inventario y Stock" active={currentView === 'inventory'} onClick={() => setCurrentView('inventory')} />
              <NavItem icon={<History size={20} />} label="Auditoría de Ventas" active={currentView === 'sales'} onClick={() => setCurrentView('sales')} />
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={logout} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {currentView === 'pos' && <POSView />}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'sales' && <SalesView />}
      </main>
    </div>
  );
}
