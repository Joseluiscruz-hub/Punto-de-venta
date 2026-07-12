import { useState, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  isSidebarOpen: boolean;
  onMenuClick: () => void;
}

export function Header({ isSidebarOpen, onMenuClick }: HeaderProps) {
  const { user, store } = useAuth();
  const [time, setTime] = useState(new Date());
  const logoSrc = `${import.meta.env.BASE_URL}el-triunfo-logo.png.png`;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="hidden lg:flex items-center justify-between px-8 py-4 top-command-strip">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-label text-slate-400">Colaborador</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
          <div>
            <p className="text-label text-slate-400">Sucursal</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{store?.name}</p>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
          <div>
            <p className="text-label text-slate-400">Terminal</p>
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

      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700 shadow-sm">
        <button
          onClick={onMenuClick}
          aria-label={isSidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
          aria-expanded={isSidebarOpen}
          className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="text-center flex flex-col items-center gap-1">
          <img src={logoSrc} alt="El Triunfo" className="h-7 w-7 object-contain" />
          <h1 className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-tight">
            EL TRIUNFO
          </h1>
        </div>

        <div className="w-10" />
      </div>
    </>
  );
}
