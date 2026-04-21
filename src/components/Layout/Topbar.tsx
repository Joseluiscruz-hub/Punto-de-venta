import { useState, useEffect } from 'react';
import { Bell, User, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Topbar() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header className="h-[80px] bg-slate-50 border-b border-border-subtle flex items-center justify-between px-8 shrink-0 shadow-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-3xl bg-primary flex items-center justify-center text-bg shadow-sm">
            <span className="text-lg font-black">E</span>
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-text-strong">El Triunfo</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Retail OS</p>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">
          <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">Sucursal Central</span>
          <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">Caja 01</span>
          <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">{today}</span>
          <span className={`px-3 py-2 rounded-2xl font-black ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isOnline ? 'Conectado' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="hidden md:flex items-center gap-2 px-4 py-3 bg-white border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary hover:bg-slate-100 transition-all">
          <Search size={16} /> Buscar
        </button>
        <button className="relative p-3 bg-white border border-border-subtle rounded-2xl text-text-secondary hover:text-primary transition-colors">
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error border border-white" />
        </button>
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border-subtle rounded-2xl">
          <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-text-secondary">
            <User size={18} />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-text-strong leading-none">{user?.name || 'Operador'}</p>
            <p className="text-[9px] uppercase tracking-[0.32em] text-text-secondary">{user?.role || 'Cajero'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
