import { Search, MapPin, Bell, User, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Topbar() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header className="h-[72px] bg-bg border-b border-border-subtle flex items-center justify-between px-8 z-30 shrink-0">
      <div className="flex items-center gap-6 flex-1 max-w-2xl">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar global (folios, productos, clientes)..."
            className="w-full h-[44px] bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-enterprise text-text-strong placeholder:text-text-secondary/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-surface-1 border border-border-subtle rounded-xl text-text-secondary">
          <MapPin size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest">Sucursal Central</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-text-secondary">
          <Calendar size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">{today}</span>
        </div>

        <button className="relative p-2 text-text-secondary hover:text-primary transition-colors">
          <Bell size={20} />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-bg"></div>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border-subtle">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-text-strong leading-none mb-0.5">{user?.name}</p>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest opacity-70">{user?.role}</p>
          </div>
          <div className="w-10 h-10 bg-surface-2 rounded-xl flex items-center justify-center text-text-secondary border border-border-subtle">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
}
