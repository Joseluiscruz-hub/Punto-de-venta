import React from 'react';
import { ShoppingCart, LayoutDashboard, PackageSearch, History, LogOut, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NavItem from './NavItem';
import { motion } from 'framer-motion';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
}

export default function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800">
      <div className="p-8 flex items-center gap-4">
        <motion.div 
          whileHover={{ rotate: 10, scale: 1.1 }}
          className="bg-primary-500 text-white p-3 rounded-2xl shadow-xl shadow-primary-500/30"
        >
          <ShoppingCart size={28} />
        </motion.div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">POS PRO</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Enterprise Suite</p>
        </div>
      </div>

      <div className="px-6 py-4 mx-4 mb-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
        <div className="bg-slate-700 p-2.5 rounded-xl text-slate-300">
          {user?.role === 'ADMIN' ? <ShieldCheck size={22} className="text-emerald-400" /> : <UserCog size={22} />}
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-bold text-white truncate">{user?.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user?.role}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <NavItem 
          icon={<ShoppingCart size={20} />} 
          label="Terminal de Caja" 
          active={currentView === 'pos'} 
          onClick={() => setCurrentView('pos')} 
        />
        
        {hasPermission(['ADMIN', 'MANAGER']) && (
          <>
            <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gestión</div>
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
            />
            <NavItem 
              icon={<PackageSearch size={20} />} 
              label="Inventario" 
              active={currentView === 'inventory'} 
              onClick={() => setCurrentView('inventory')} 
            />
            <NavItem 
              icon={<History size={20} />} 
              label="Auditoría" 
              active={currentView === 'sales'} 
              onClick={() => setCurrentView('sales')} 
            />
          </>
        )}
      </nav>

      <div className="p-6">
        <button 
          onClick={logout} 
          className="flex items-center gap-3 w-full p-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/20 transition-all group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
