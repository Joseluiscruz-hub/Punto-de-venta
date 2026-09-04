import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Command,
  History,
  Menu,
  PackageSearch,
  Receipt,
  Search,
  ShoppingCart,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Role, View } from '../models/types';
import { IconButton } from './ui';

interface HeaderProps {
  currentView: View;
  isSidebarOpen: boolean;
  onMenuClick: () => void;
  onNavigate: (view: View) => void;
}

interface NavigationCommand {
  view: View;
  label: string;
  description: string;
  icon: React.ReactNode;
  roles?: Role[];
}

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  pos: { title: 'Punto de venta', subtitle: 'Cobro y atención al cliente' },
  dashboard: { title: 'Resumen', subtitle: 'Indicadores del negocio' },
  inventory: { title: 'Inventario', subtitle: 'Productos y existencias' },
  clients: { title: 'Clientes', subtitle: 'Directorio y lealtad' },
  sales: { title: 'Ventas registradas', subtitle: 'Tickets y reportes' },
  movements: { title: 'Movimientos', subtitle: 'Auditoría de inventario' },
  corte: { title: 'Caja y turnos', subtitle: 'Control de efectivo' },
  audit: { title: 'Auditoría', subtitle: 'Eventos y exportación' },
};

const COMMANDS: NavigationCommand[] = [
  {
    view: 'pos',
    label: 'Punto de venta',
    description: 'Cobrar productos y gestionar el carrito',
    icon: <ShoppingCart size={18} />,
  },
  {
    view: 'dashboard',
    label: 'Resumen',
    description: 'Ver indicadores y rendimiento',
    icon: <BarChart3 size={18} />,
  },
  {
    view: 'inventory',
    label: 'Inventario',
    description: 'Consultar productos y existencias',
    icon: <PackageSearch size={18} />,
  },
  {
    view: 'clients',
    label: 'Clientes',
    description: 'Administrar el directorio de clientes',
    icon: <Users size={18} />,
  },
  {
    view: 'sales',
    label: 'Ventas registradas',
    description: 'Consultar tickets y exportar reportes',
    icon: <Receipt size={18} />,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    view: 'movements',
    label: 'Movimientos',
    description: 'Revisar entradas, salidas y ajustes',
    icon: <History size={18} />,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    view: 'corte',
    label: 'Caja y turnos',
    description: 'Abrir, revisar o cerrar el turno',
    icon: <Wallet size={18} />,
  },
  {
    view: 'audit',
    label: 'Auditoría',
    description: 'Consultar eventos y exportar CSV',
    icon: <ShieldCheck size={18} />,
    roles: ['ADMIN', 'MANAGER'],
  },
];

export function Header({ currentView, isSidebarOpen, onMenuClick, onNavigate }: HeaderProps) {
  const { user, store, hasPermission } = useAuth();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const current = VIEW_TITLES[currentView];

  const allowedCommands = useMemo(
    () => COMMANDS.filter((command) => !command.roles || hasPermission(command.roles)),
    [hasPermission],
  );

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allowedCommands;
    return allowedCommands.filter(
      (command) =>
        command.label.toLocaleLowerCase().includes(normalized) ||
        command.description.toLocaleLowerCase().includes(normalized),
    );
  }, [allowedCommands, query]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
        setQuery('');
      }
      if (event.key === 'Escape') {
        setIsCommandOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  useEffect(() => {
    if (!isCommandOpen) return;
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [isCommandOpen]);

  const navigate = (view: View) => {
    onNavigate(view);
    setIsCommandOpen(false);
    setQuery('');
  };

  return (
    <>
      <header className="top-command-strip flex shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            onClick={onMenuClick}
            label={isSidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
            aria-expanded={isSidebarOpen}
            className="header-menu-button"
          >
            {isSidebarOpen ? <X size={21} /> : <Menu size={21} />}
          </IconButton>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-slate-950 dark:text-white sm:text-lg">
              {current.title}
            </h2>
            <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
              {current.subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div
            className={`hidden items-center gap-2 text-xs font-semibold sm:flex ${
              isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            {isOnline ? 'En línea' : 'Sin conexión'}
          </div>
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="command-trigger"
            aria-label="Abrir navegación rápida"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Ir a...</span>
            <kbd className="command-shortcut">Ctrl K</kbd>
          </button>
          <div className="hidden border-l border-slate-200 pl-3 text-right dark:border-slate-800 md:block">
            <p className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{store?.name}</p>
          </div>
          <div
            className="user-avatar hidden h-9 w-9 items-center justify-center text-xs font-extrabold lg:flex"
            title={user?.name}
          >
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {isCommandOpen && (
        <div
          className="command-palette-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsCommandOpen(false);
              setQuery('');
            }
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación rápida"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
              <Search className="shrink-0 text-slate-400" size={19} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filteredCommands[0]) {
                    navigate(filteredCommands[0].view);
                  }
                }}
                placeholder="Buscar módulo..."
                className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-white"
              />
              <Command size={18} className="text-slate-400" />
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {filteredCommands.map((command) => (
                <button
                  key={command.view}
                  type="button"
                  onClick={() => navigate(command.view)}
                  className={`command-item ${
                    currentView === command.view ? 'command-item-active' : ''
                  }`}
                >
                  <span className="command-item-icon">{command.icon}</span>
                  <span className="min-w-0 text-left">
                    <strong className="block truncate text-sm">{command.label}</strong>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {command.description}
                    </span>
                  </span>
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay módulos que coincidan.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
