import {
  ShoppingCart, PackageSearch, ShoppingBag, Users,
  Tags, BarChart3, Settings, LogOut, Store, LayoutDashboard, History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NavItem from './NavItem';
import type { ViewType } from './MainLayout';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

export default function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { logout } = useAuth();

  const menuGroups = [
    {
      label: null,
      items: [
        { id: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={18} /> },
      ]
    },
    {
      label: 'Operación',
      items: [
        { id: 'pos', label: 'Caja', icon: <ShoppingCart size={18} /> },
        { id: 'clients', label: 'Clientes', icon: <Users size={18} /> },
      ]
    },
    {
      label: 'Catálogo',
      items: [
        { id: 'inventory', label: 'Inventario', icon: <PackageSearch size={18} /> },
        { id: 'prices', label: 'Precios', icon: <Tags size={18} /> },
      ]
    },
    {
      label: 'Abasto',
      items: [
        { id: 'purchases', label: 'Compras', icon: <ShoppingBag size={18} /> },
      ]
    },
    {
      label: 'Análisis',
      items: [
        { id: 'sales', label: 'Auditoría', icon: <History size={18} /> },
        { id: 'reports', label: 'Reportes', icon: <BarChart3 size={18} /> },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-bg border-r border-border-subtle flex flex-col h-screen shrink-0 z-40">
      <div className="h-[72px] px-6 flex items-center gap-3 border-b border-border-subtle shrink-0">
        <div className="bg-primary p-2 rounded-lg">
          <Store size={20} className="text-bg" strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-black tracking-tighter text-text-strong">RETAIL OS</h1>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-8 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {group.label && (
              <p className="px-4 text-[10px] font-black text-text-secondary/40 uppercase tracking-[0.3em] mb-3">
                {group.label}
              </p>
            )}
            {group.items.map(item => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={currentView === item.id}
                onClick={() => setCurrentView(item.id as ViewType)}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border-subtle">
        <NavItem
          icon={<Settings size={18} />}
          label="Configuración"
          active={currentView === 'config'}
          onClick={() => setCurrentView('config')}
        />
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full p-3 rounded-xl text-text-secondary hover:text-error hover:bg-error/5 transition-enterprise mt-2 group"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-wider">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
