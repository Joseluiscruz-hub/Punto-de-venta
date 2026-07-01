import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { 
  ShoppingCart, LayoutDashboard, PackageSearch, Receipt, LogOut, 
  Plus, Search, Trash2, Edit, Barcode, Banknote,
  TrendingUp, AlertCircle, CheckCircle2, UserCog, ShieldCheck,
  History, X, Store as StoreIcon, Sun, Moon, Upload, Menu,
  Printer, QrCode, CloudUpload, WifiOff, BarChart3, PieChart as PieIcon,
  Wallet, Landmark, ArrowDownCircle, Users, Mail, Phone, Download, CalendarDays
} from 'lucide-react';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';

import {
  Tenant, Store, User, Sale, ProductView, RequestContext,
  Feature, Role, PaymentMethod, Shift, Client, CreateProductInput, Session, ProcessSaleInput,
  UpdateProductInput, StockMovementView
} from './models/types';
import { BackendAPI } from './data/backend';

// ============================================================================
// 1. UTILIDADES Y CONSTANTES
// ============================================================================

function hasFeature(tenant: Tenant | null, feature: Feature) {
  if (!tenant) return false;
  const planFeatures: Record<Tenant['plan'], Feature[]> = {
    BASIC: ['POS', 'INVENTORY'],
    PRO: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT'],
    PREMIUM: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT', 'OFFLINE', 'API'],
  };
  return planFeatures[tenant.plan].includes(feature);
}

const SESSION_KEY = 'el-triunfo.enterprise-session.v2';
const THEME_KEY = 'el-triunfo.theme';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function createOfflineId() {
  return `OFF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function productInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'ET';
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

type StockFilter = 'ALL' | 'LOW' | 'OUT';
type InventorySortKey = 'name' | 'category' | 'price' | 'stock';
type SortDirection = 'asc' | 'desc';
type SalesPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

const PERIOD_OPTIONS: Array<{ key: SalesPeriod; label: string }> = [
  { key: 'TODAY', label: 'Hoy' },
  { key: 'WEEK', label: '7 dias' },
  { key: 'MONTH', label: '30 dias' },
  { key: 'ALL', label: 'Todo' },
];

// Inicio del periodo (medianoche local) usado para filtrar ventas por fecha.
function startOfPeriod(period: SalesPeriod): number {
  if (period === 'ALL') return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'WEEK') start.setDate(start.getDate() - 6);
  if (period === 'MONTH') start.setDate(start.getDate() - 29);
  return start.getTime();
}

// Descarga un archivo de texto en el navegador sin dependencias externas.
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// ============================================================================
// 3. ESTADO GLOBAL (AuthContext)
// ============================================================================

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  store: Store | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
  reqContext: RequestContext;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================================
// 3.5 THEME CONTEXT
// ============================================================================

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function useThemeProvider() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(THEME_KEY) !== 'light');
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(!isDark) };
}

function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}

// ============================================================================
// 4. APP COMPONENT
// ============================================================================

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const themeData = useThemeProvider();
  
  const login = async (username: string, pin: string) => {
    const data = await BackendAPI.login(username, pin);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, token: '' }));
    setSession(data);
  };
  
  const logout = () => {
    void BackendAPI.logout();
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  useEffect(() => {
    const expireSession = () => setSession(null);
    window.addEventListener('el-triunfo:session-expired', expireSession);
    return () => window.removeEventListener('el-triunfo:session-expired', expireSession);
  }, []);
  
  const hasPermission = (roles: Role[]) => {
    return session ? roles.includes(session.user.role) : false;
  };

  const reqContext = useMemo(() => session ? {
    tenantId: session.tenant.id,
    storeId: session.store.id,
    userId: session.user.id
  } : { tenantId: '', storeId: '', userId: '' }, [session]);

  const authValue = {
    user: session?.user || null,
    tenant: session?.tenant || null,
    store: session?.store || null,
    login, logout, hasPermission, reqContext
  };

  if (!session) {
    return (
      <ThemeContext.Provider value={themeData}>
        <AuthContext.Provider value={authValue}>
          <LoginScreen />
        </AuthContext.Provider>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeData}>
      <AuthContext.Provider value={authValue}>
        <MainLayout />
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

// ============================================================================
// 5. LAYOUT Y NAVEGACIÓN
// ============================================================================

interface OfflineSaleRecord {
  saleId: string;
  reqContext: RequestContext;
  saleData: ProcessSaleInput;
}

function readOfflineSales(): OfflineSaleRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('offline_sales') ?? '[]');
    return Array.isArray(parsed) ? parsed as OfflineSaleRecord[] : [];
  } catch {
    localStorage.setItem('offline_sales', '[]');
    return [];
  }
}

function SyncManager() {
  const { tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => readOfflineSales().length);
  const syncingRef = useRef(false);

  const syncSales = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const failed: OfflineSaleRecord[] = [];
      for (const record of readOfflineSales()) {
        try {
          await BackendAPI.processSale(record.reqContext, {
            ...record.saleData,
            externalId: record.saleId,
          });
        } catch (error) {
          console.error('Error al sincronizar venta:', error);
          failed.push(record);
        }
      }
      localStorage.setItem('offline_sales', JSON.stringify(failed));
      setPendingCount(failed.length);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      const count = readOfflineSales().length;
      setPendingCount(count);
      if (navigator.onLine && count > 0 && hasFeature(tenant, 'OFFLINE')) void syncSales();
    };
    const handleOnline = () => { setIsOnline(true); void syncSales(); };
    const handleOffline = () => setIsOnline(false);
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 5000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [syncSales, tenant]);

  if (!hasFeature(tenant, 'OFFLINE')) return null;

  if (!isOnline) {
    return (
      <div className="bg-[#ba1c1c] text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-sm z-50">
        <WifiOff size={14} className="animate-pulse" /> 
        <span>Conexión Interrumpida. Modo Reserva ERP Activo. {pendingCount > 0 ? `(${pendingCount} transacciones en cola)` : ''}</span>
      </div>
    );
  }

  if (isOnline && isSyncing) {
    return (
      <div className="bg-[#0070b2] text-white text-[10px] sm:text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md z-50">
        <CloudUpload size={14} className="animate-pulse" /> 
        <span>Sincronizando transacciones con el Sistema Central SAP...</span>
      </div>
    );
  }

  return null;
}

function MainLayout() {
  const { user, tenant, store, logout, hasPermission, reqContext } = useAuth();
  type View = 'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements' | 'corte' | 'clients';
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const viewMeta: Record<View, { title: string; eyebrow: string }> = {
    pos: { title: 'Punto de venta', eyebrow: 'Operacion en caja' },
    dashboard: { title: 'Panel ejecutivo', eyebrow: 'Indicadores y margen' },
    inventory: { title: 'Inventario', eyebrow: 'Maestro de productos' },
    sales: { title: 'Ventas', eyebrow: 'Libro fiscal' },
    movements: { title: 'Auditoria de stock', eyebrow: 'Trazabilidad' },
    corte: { title: 'Corte de caja', eyebrow: 'Turnos y efectivo' },
    clients: { title: 'Clientes', eyebrow: 'Cartera y lealtad' },
  };
  
  useEffect(() => {
    BackendAPI.getActiveShift(reqContext).then(shift => {
      if (!shift) setShowOpenShiftModal(true);
      else setActiveShift(shift);
    });
  }, [reqContext]);

  const auditEnabled = hasFeature(tenant, 'AUDIT');

  const navItemClick = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-bg flex h-screen font-sans text-slate-900 dark:text-[#E2E8F0] overflow-hidden transition-colors relative">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`side-rail fixed inset-y-0 left-0 z-50 w-72 lg:w-72 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="brand-panel p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center font-bold text-white shrink-0 border border-white/20 shadow-lg shadow-black/10">
              <StoreIcon size={18} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-tight uppercase">EL TRIUNFO</h1>
              <p className="text-[10px] text-white/75 font-bold tracking-[0.22em] uppercase">Retail Command</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 lg:hidden text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="side-profile mx-4 mt-4 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/20 text-white">
              {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-white"/> : <UserCog size={20} className="text-white"/>}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] uppercase font-black tracking-[0.18em] text-teal-700 dark:text-teal-300">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/55 dark:bg-black/20 p-3 border border-white/60 dark:border-white/5 rounded-2xl">
            <StoreIcon size={14} className="text-teal-600 dark:text-teal-300 shrink-0" />
            <span className="truncate">{store?.name}</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto flex flex-col gap-0.5">
          <div className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-1">Capa de Operaciones</div>
          <NavItem icon={<ShoppingCart size={18} />} label="Ventas & Punto de Venta" active={currentView === 'pos'} onClick={() => navItemClick('pos')} />
          <NavItem icon={<Wallet size={18} />} label="Corte de Caja & Turnos" active={currentView === 'corte'} onClick={() => navItemClick('corte')} />
          <NavItem icon={<Users size={18} />} label="Directorio de Clientes" active={currentView === 'clients'} onClick={() => navItemClick('clients')} />
          
          {hasPermission(['ADMIN', 'MANAGER']) && (
            <>
              <div className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mt-4 mb-1">Administración de Recursos</div>
              <NavItem icon={<LayoutDashboard size={18} />} label="Panel Estratégico (KPIs)" active={currentView === 'dashboard'} onClick={() => navItemClick('dashboard')} />
              <NavItem icon={<PackageSearch size={18} />} label="Maestro de Materiales" active={currentView === 'inventory'} onClick={() => navItemClick('inventory')} />
              
              {auditEnabled && (
                <>
                  <div className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mt-4 mb-1">Cumplimiento y Registro</div>
                  <NavItem icon={<Receipt size={18} />} label="Libro de Diario de Ventas" active={currentView === 'sales'} onClick={() => navItemClick('sales')} />
                  <NavItem icon={<History size={18} />} label="Auditoría de Stock" active={currentView === 'movements'} onClick={() => navItemClick('movements')} />
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 flex flex-col gap-3">
          <button onClick={logout} className="btn-secondary flex items-center justify-center gap-2 px-4 py-3 text-xs active:scale-95">
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="flex justify-center">
             <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="main-canvas flex-1 flex flex-col min-w-0 transition-colors">
        <SyncManager />
        <div className="top-command-strip hidden lg:flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="top-icon-button xl:hidden" aria-label="Abrir menu">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 dark:text-slate-400">{viewMeta[currentView].eyebrow}</p>
              <h2 className="text-lg font-black text-slate-950 dark:text-white truncate">{viewMeta[currentView].title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="top-store-pill">
              <StoreIcon size={15} />
              <span className="truncate">{store?.name ?? 'Sucursal'}</span>
            </div>
            <div className="top-store-pill">
              <UserCog size={15} />
              <span className="truncate">{user?.name ?? 'Usuario'}</span>
            </div>
          </div>
        </div>
        
        <div className="brand-panel lg:hidden flex items-center justify-between p-4 text-white">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-white/80 hover:bg-white/10 rounded transition-colors">
              <Menu size={24} />
            </button>
            <span className="font-bold tracking-tight uppercase">EL TRIUNFO</span>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {currentView === 'pos' && <POSView />}
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'sales' && <SalesView />}
          {currentView === 'movements' && <MovementsView />}
          {currentView === 'corte' && <CorteCajaView onShiftClosed={() => { setActiveShift(null); setShowOpenShiftModal(true); setCurrentView('pos'); }} />}
          {currentView === 'clients' && <ClientsView />}
        </div>
        {showOpenShiftModal && <OpenShiftModal onOpen={(shift) => { setActiveShift(shift); setShowOpenShiftModal(false); }} />}
      </main>
    </div>
  );
}

// ============================================================================
// 6. LOGIN
// ============================================================================

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(username, pin);
    } catch (error) {
      setError(errorMessage(error, 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell text-slate-900 dark:text-[#E2E8F0] font-sans flex items-center justify-center p-4 transition-colors">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="login-stage grid lg:grid-cols-[1.08fr_0.92fr] gap-5">
        <section className="login-hero-card hidden lg:flex min-h-[620px] rounded-[32px] p-10 text-white flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-2xl">
              <StoreIcon size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] font-black text-white/70">Retail Command Center</p>
              <h1 className="text-3xl font-black tracking-tight">El Triunfo ERP</h1>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[10px] uppercase tracking-[0.22em] font-black">
              <ShieldCheck size={14} /> Sesion blindada
            </div>
            <h2 className="text-6xl font-black tracking-[-0.08em] leading-none">
              Operacion de tienda con presencia de corporativo.
            </h2>
            <p className="text-sm leading-6 text-white/72 max-w-md">
              Punto de venta, turnos, inventario, clientes y auditoria en una experiencia rapida, clara y lista para escalar.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ['99.9%', 'Disponibilidad'],
              ['<1s', 'Flujo POS'],
              ['360', 'Control visual'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-black tracking-tight">{value}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/62 font-bold mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="login-card p-8 sm:p-10 rounded-[32px] w-full transition-colors">
          <div className="flex flex-col items-center mb-10">
            <div className="brand-panel text-white p-4 rounded-3xl mb-5 shadow-2xl shrink-0 border border-white/10">
              <StoreIcon size={38} />
            </div>
            <p className="section-kicker mb-2">Portal de acceso</p>
            <h1 className="text-4xl font-black tracking-[-0.08em] text-gradient uppercase">EL TRIUNFO ERP</h1>
            <p className="text-slate-500 dark:text-slate-400 text-center mt-4 text-xs uppercase tracking-widest font-bold">
              Acceso centralizado para operacion premium
              <br/><br/> <span className="font-mono text-[10px] text-slate-400">Demo segura: admin / 1234</span>
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-[0.18em]">Identificador de Usuario</label>
               <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="input-premium w-full p-4 text-slate-900 dark:text-[#E2E8F0] outline-none transition-all font-bold" placeholder="ID de Usuario" autoFocus />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-[0.18em]">Clave PIN de Acceso</label>
               <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className="input-premium w-full text-center tracking-[1em] text-2xl p-4 text-slate-900 dark:text-white outline-none transition-all font-bold" maxLength={4} />
            </div>
            {error && <p className="text-[#ba1c1c] text-[11px] font-bold text-center uppercase tracking-tight">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-sm active:scale-[0.98]">{loading ? 'Validando...' : 'Iniciar Sesión'}</button>
          </form>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
             <div className="rounded-2xl bg-white/45 dark:bg-white/5 border border-white/40 dark:border-white/10 p-3">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">POS</p>
             </div>
             <div className="rounded-2xl bg-white/45 dark:bg-white/5 border border-white/40 dark:border-white/10 p-3">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Stock</p>
             </div>
             <div className="rounded-2xl bg-white/45 dark:bg-white/5 border border-white/40 dark:border-white/10 p-3">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">CRM</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PUNTO DE VENTA
// ============================================================================

function POSView() {
  const { reqContext, tenant, store } = useAuth();
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

  const [products, setProducts] = useState<ProductView[]>([]);
  const [cart, setCart] = useState<(ProductView & { quantity: number, subtotal: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 140);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmSaleInfo, setConfirmSaleInfo] = useState<{ paymentMethod: PaymentMethod; amountTendered: number } | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; saleData?: Sale } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // CRM State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [clientSearch, setClientSearch] = useState('');

  const showActionToast = useCallback((message: string) => {
    setActionToast(message);
    window.setTimeout(() => setActionToast(current => current === message ? null : current), 1800);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([BackendAPI.getStoreProducts(reqContext), BackendAPI.getClients(reqContext)])
      .then(([productData, clientData]) => {
        if (!active) return;
        setProducts(productData);
        setClients(clientData);
      })
      .catch((error) => {
        if (active) setAlertInfo({ title: 'Catalogo no disponible', message: errorMessage(error, 'No se pudo cargar el catalogo.') });
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false);
      });
    return () => { active = false; };
  }, [reqContext]);

  const filteredClients = useMemo(() => clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
  ), [clients, clientSearch]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const categories = useMemo(() => {
    const counts = products.reduce<Record<string, number>>((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(debouncedSearchQuery);
    return products.filter(product => {
      const inCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      const matchesQuery = !query
        || normalizeText(product.name).includes(query)
        || normalizeText(product.category).includes(query)
        || product.barcode.toLowerCase().includes(query);
      return inCategory && matchesQuery;
    });
  }, [products, debouncedSearchQuery, selectedCategory]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    cart.forEach(item => quantities.set(item.id, item.quantity));
    return quantities;
  }, [cart]);
  const recentProducts = useMemo(() => recentProductIds
    .map(id => products.find(product => product.id === id))
    .filter((product): product is ProductView => Boolean(product))
    .slice(0, 5), [products, recentProductIds]);

  const addToCart = useCallback((product: ProductView) => {
    if (product.stock <= 0) {
      showActionToast(`${product.name} esta agotado`);
      return;
    }
    const currentQuantity = cart.find(item => item.id === product.id)?.quantity ?? 0;
    if (currentQuantity >= product.stock) {
      showActionToast(`Stock maximo: ${product.stock} unidades`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } : item);
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price }];
    });
    setRecentProductIds(prev => [product.id, ...prev.filter(id => id !== product.id)].slice(0, 5));
    setSearchQuery('');
    showActionToast(`${product.name} agregado`);
  }, [cart, showActionToast]);

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    const p = products.find(x => x.id === id);
    if (!p || newQuantity > p.stock) return;
    setCart(prev => prev.map(item => item.id === id 
      ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price } : item));
  };

  const executeCheckout = async () => {
    if (!confirmSaleInfo) return;
    setIsProcessing(true);
    try {
      if (!isOnline && hasFeature(tenant, 'OFFLINE')) {
        const offlineId = createOfflineId();
        const offlineSale = {
          saleId: offlineId,
          reqContext,
          saleData: {
            items: cart,
            paymentMethod: confirmSaleInfo.paymentMethod,
            amountTendered: confirmSaleInfo.amountTendered,
            clientId: selectedClientId,
            isOfflineSync: true,
            offlineDate: new Date().toISOString(),
            externalId: offlineId,
          }
        } satisfies OfflineSaleRecord;

        const existing = readOfflineSales();
        existing.push(offlineSale);
        localStorage.setItem('offline_sales', JSON.stringify(existing));

        setCart([]);
        setShowPaymentModal(false);
        setConfirmSaleInfo(null);
        
        const pseudoSale: Sale = {
           id: offlineId,
           tenantId: reqContext.tenantId,
           storeId: reqContext.storeId,
           cashierId: reqContext.userId,
           datetime: offlineSale.saleData.offlineDate,
           total: cartTotal,
           paymentMethod: confirmSaleInfo.paymentMethod,
           amountTendered: confirmSaleInfo.amountTendered,
           changeAmount: confirmSaleInfo.amountTendered - cartTotal,
           itemsCount: cart.reduce((s, i) => s + i.quantity, 0),
           items: cart.map((item) => ({
             id: `${offlineId}-${item.id}`,
             saleId: offlineId,
             productId: item.id,
             name: item.name,
             quantity: item.quantity,
             price: item.price,
             cost: item.cost,
             subtotal: item.subtotal,
           })),
        };

        setAlertInfo({ 
          title: 'Venta Registrada (Offline)', 
          message: `Estás sin conexión. La venta se ha guardado localmente y se sincronizará automáticamente cuando te conectes.`,
          saleData: pseudoSale
        });
      } else if (!isOnline) {
        throw new Error('No tienes conexión a internet y tu plan actual no soporta Modo Offline.');
      } else {
        const sale = await BackendAPI.processSale(reqContext, {
          items: cart,
          paymentMethod: confirmSaleInfo.paymentMethod,
          amountTendered: confirmSaleInfo.amountTendered,
          clientId: selectedClientId
        });
        setCart([]);
        setShowPaymentModal(false);
        setConfirmSaleInfo(null);
        setSelectedClientId(undefined);
        const updated = await BackendAPI.getStoreProducts(reqContext);
        setProducts(updated);
        setAlertInfo({ 
          title: 'Venta Procesada', 
          message: `La venta se procesó correctamente.`,
          saleData: sale 
        });
      }
    } catch (error) {
      setAlertInfo({ title: 'Error en la Venta', message: errorMessage(error, 'No se pudo procesar la venta') });
      setConfirmSaleInfo(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = (paymentMethod: PaymentMethod, amountTendered: number) => {
    setShowPaymentModal(false);
    setConfirmSaleInfo({ paymentMethod, amountTendered });
  };

  const addSearchResultToCart = useCallback(() => {
    const query = normalizeText(searchQuery);
    const exactBarcode = products.find(product => product.barcode.toLowerCase() === query);
    const exactName = products.find(product => normalizeText(product.name) === query);
    const candidate = exactBarcode || exactName || (filteredProducts.length === 1 ? filteredProducts[0] : null);
    if (!candidate) {
      showActionToast(query ? 'Refina la busqueda para agregar rapido' : 'Escanea o busca un producto');
      return false;
    }
    addToCart(candidate);
    return true;
  }, [addToCart, filteredProducts, products, searchQuery, showActionToast]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSearchResultToCart();
    }
    if (event.key === 'Escape') {
      setSearchQuery('');
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.key === 'F2' || (key === '/' && !isEditableTarget(event.target))) && !showPaymentModal && !confirmSaleInfo) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if ((event.key === 'F9' || ((event.ctrlKey || event.metaKey) && key === 'enter')) && cart.length > 0 && !showPaymentModal && !confirmSaleInfo) {
        event.preventDefault();
        setShowPaymentModal(true);
      }

      if (event.key === 'Escape') {
        if (showPaymentModal) setShowPaymentModal(false);
        else if (isCartOpen) setIsCartOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.length, confirmSaleInfo, isCartOpen, showPaymentModal]);

  return (
    <div className="view-shell flex h-full relative overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="modal-card p-8 rounded-[28px] flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-[#0070b2] border-t-transparent rounded-full animate-spin"></div>
             <span className="text-teal-700 dark:text-teal-300 font-black uppercase tracking-widest text-xs">Sincronizando con ERP...</span>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col p-4 lg:p-6 h-full overflow-hidden transition-colors relative">
        {confirmSaleInfo && <ConfirmDialog title="Confirmar Movimiento" message={`¿Estás seguro de completar esta transacción por ${formatCurrency(cartTotal)}?`} onConfirm={executeCheckout} onCancel={() => setConfirmSaleInfo(null)} />}
        {alertInfo && !alertInfo.saleData && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
        {alertInfo?.saleData && <ReceiptModal sale={alertInfo.saleData} onClose={() => setAlertInfo(null)} storeName={store?.name ?? 'Sucursal'} />}
        {actionToast && <div className="toast-floating">{actionToast}</div>}
        
        <div className="search-hero pos-command mb-5 p-4 lg:p-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
            <div>
              <p className="section-kicker">Operacion en vivo</p>
              <h2 className="text-2xl lg:text-4xl font-black tracking-[-0.06em] text-slate-950 dark:text-white">Punto de venta inteligente</h2>
              <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1 font-semibold">Captura rapida, stock visible y cobro con flujo de caja.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right">
              <div className="status-chip px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] font-black">Estado</p>
                <p className="text-xs font-black">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
              <div className="status-chip px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] font-black">Items</p>
                <p className="text-xs font-black">{cartItemsCount}</p>
              </div>
              <div className="status-chip px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] font-black">Total</p>
                <p className="text-xs font-black">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
          </div>
          <div className="input-premium search-focus-ring p-3 flex items-center gap-4 transition-colors">
            <Barcode size={24} className="text-teal-600 dark:text-teal-300 hidden sm:block" />
            <Search size={24} className="text-teal-600 dark:text-teal-300 sm:hidden" />
            <input
              ref={searchInputRef}
              type="text" placeholder="Buscar producto o código..." className="flex-1 text-base lg:text-lg outline-none bg-transparent text-slate-900 dark:text-white font-bold placeholder:text-slate-400"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} autoFocus
            />
            <button type="button" onClick={addSearchResultToCart} className="hidden md:flex btn-secondary px-4 py-2 text-[10px] items-center gap-2">
              Enter <Plus size={14} />
            </button>
          </div>
          <div className="mt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('Todos')}
                className={`category-chip ${selectedCategory === 'Todos' ? 'category-chip-active' : ''}`}
              >
                Todos <span>{products.length}</span>
              </button>
              {categories.map(category => (
                <button
                  type="button"
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`category-chip ${selectedCategory === category.name ? 'category-chip-active' : ''}`}
                >
                  {category.name} <span>{category.count}</span>
                </button>
              ))}
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] font-black text-slate-400">
              <span className="shortcut-chip">F2 Buscar</span>
              <span className="shortcut-chip">Enter Agregar</span>
              <span className="shortcut-chip">F9 Cobrar</span>
              <span className="shortcut-chip">Esc Cerrar</span>
            </div>
          </div>
          {recentProducts.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400">Recientes</span>
              {recentProducts.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="recent-chip"
                  title={`Agregar ${product.name}`}
                >
                  {product.name}
                  <span>{formatCurrency(product.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
          {isCatalogLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-4 pb-32">
              {Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton-card" />)}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-4 pb-32">
              {filteredProducts.map(product => {
                const quantityInCart = cartQuantities.get(product.id) ?? 0;
                return (
              <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                className="product-tile text-left p-0 transition-all flex flex-col group disabled:opacity-45 disabled:hover:translate-y-0 disabled:shadow-none">

                {quantityInCart > 0 && (
                  <span className="absolute top-3 right-3 z-10 min-w-7 h-7 px-2 rounded-full bg-teal-500 text-white text-xs font-black flex items-center justify-center shadow-lg shadow-teal-500/30">
                    {quantityInCart}
                  </span>
                )}

                <div className="product-media w-full h-32 sm:h-40 overflow-hidden border-b border-white/30 dark:border-white/5">
                  <ProductArtwork product={product} />
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1 w-full">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate mr-1">{product.category}</span>
                    {product.stock <= product.minStock && product.stock > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm border border-amber-200 dark:border-amber-700/30 shrink-0">Bajo Stock</span>}
                    {product.stock <= 0 && <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-sm border border-red-200 dark:border-red-700/30 shrink-0">Agotado</span>}
                  </div>
                  <h3 className="font-black text-xs text-slate-800 dark:text-white line-clamp-2 h-8 leading-snug mb-2">{product.name}</h3>
                  <div className="mt-auto flex justify-between items-baseline pt-2 border-t border-slate-50 dark:border-white/5">
                    <span className="text-teal-700 dark:text-teal-300 font-black text-base">{formatCurrency(product.price)}</span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase">Stock: {product.stock}</span>
                  </div>
                  <div className="product-action-hint mt-3">
                    <Plus size={13} />
                    <span>Agregar al carrito</span>
                  </div>
                </div>
              </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel h-full min-h-[340px] flex flex-col items-center justify-center text-center p-8">
              <PackageSearch size={42} className="text-teal-500 mb-4" />
              <h3 className="text-2xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">No encontramos productos</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md">Prueba otra categoria, escanea el codigo completo o limpia la busqueda para volver al catalogo.</p>
              <button type="button" onClick={() => { setSearchQuery(''); setSelectedCategory('Todos'); searchInputRef.current?.focus(); }} className="btn-secondary px-5 py-3 text-xs mt-6">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="lg:hidden absolute bottom-6 inset-x-4">
            <button onClick={() => setIsCartOpen(true)} className="btn-primary w-full p-4 flex items-center justify-between text-xs shadow-2xl">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span>Carrito ({cartItemsCount})</span>
              </div>
              <span className="text-base">{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      <div className={`cart-drawer fixed inset-y-0 right-0 z-40 w-full sm:w-96 lg:static flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="brand-panel p-4 flex items-center justify-between text-white">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-white/65">Checkout</p>
            <h2 className="font-black text-sm uppercase tracking-widest">Resumen de Materiales</h2>
          </div>
          <div className="flex items-center gap-1">
            {cart.length > 0 && (
              <button
                onClick={() => { setCart([]); setSelectedClientId(undefined); showActionToast('Carrito vaciado'); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.16em] text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                title="Vaciar carrito"
              >
                <Trash2 size={13} /> Vaciar
              </button>
            )}
            <button onClick={() => setIsCartOpen(false)} className="p-2 text-white/75 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-white/20 dark:bg-black/5">
          {cart.map(item => (
            <div key={item.id} className="cart-line flex gap-3 p-3 text-slate-900 dark:text-white items-center shadow-sm">
              <div className="flex items-center gap-1 bg-slate-50/80 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 p-1">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center justify-center"><Trash2 size={13} /></button>
                <span className="font-black text-sm min-w-[28px] text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-xl hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-300 transition-colors flex items-center justify-center"><Plus size={14} /></button>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <h4 className="font-bold text-xs truncate">{item.name}</h4>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-mono">{formatCurrency(item.price)} C/U</span>
              </div>
              <div className="font-black text-xs text-teal-700 dark:text-teal-300 whitespace-nowrap">{formatCurrency(item.subtotal)}</div>
            </div>
          ))}
          {!cart.length && <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 p-10 uppercase font-bold tracking-widest text-xs"><ShoppingCart size={32} /> Carrito Vacío</div>}
        </div>

        {/* CRM Selector */}
        <div className="p-4 bg-white/45 dark:bg-slate-950/20 border-t border-white/20 dark:border-white/10 space-y-3">
           <div className="flex items-center justify-between">
              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Vinculación CRM</h4>
              {selectedClient && (
                <button onClick={() => setSelectedClientId(undefined)} className="text-[9px] font-bold text-red-500 hover:underline uppercase">Quitar</button>
              )}
           </div>
           
           {!selectedClient ? (
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Vincular cliente (Nombre/Tel)..." 
                  className="input-premium w-full pl-9 pr-4 py-2.5 text-[11px] font-bold outline-none"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
                {clientSearch && filteredClients.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 modal-card rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                    {filteredClients.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedClientId(c.id); setClientSearch(''); }}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border-b last:border-0 border-slate-100 dark:border-white/5"
                      >
                        <p className="font-bold text-xs">{c.name}</p>
                        <p className="text-[9px] text-slate-500 uppercase">★ {c.points} Puntos acumulados</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           ) : (
              <div className="flex items-center gap-3 bg-teal-500/10 p-2.5 rounded-2xl border border-teal-500/20">
                 <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {selectedClient.name[0]}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[#0070b2] truncate">{selectedClient.name}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase">★ Fidelidad: {selectedClient.points} pts</p>
                 </div>
              </div>
           )}
        </div>

        <div className="p-5 bg-white/55 dark:bg-slate-950/25 border-t border-white/20 dark:border-white/10 shadow-[0_-4px_22px_rgba(0,0,0,0.06)]">
          <div className="flex justify-between items-baseline mb-4 text-slate-800 dark:text-white">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-50">VALOR TOTAL NETO</span>
            <span className="text-3xl font-black tracking-tighter text-teal-700 dark:text-teal-300">{formatCurrency(cartTotal)}</span>
          </div>
          <button onClick={() => setShowPaymentModal(true)} disabled={!cart.length}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-xs active:scale-[0.98]">
            Finalizar Selección <Plus size={18} />
          </button>
        </div>
      </div>

      {showPaymentModal && <PaymentModal total={cartTotal} onClose={() => setShowPaymentModal(false)} onComplete={handleCheckout} />}
    </div>
  );
}

const PRODUCT_ART_PALETTES = [
  ['rgba(39,39,42,0.96)', 'rgba(120,113,108,0.88)'],
  ['rgba(63,63,70,0.96)', 'rgba(28,25,23,0.9)'],
  ['rgba(87,83,78,0.94)', 'rgba(41,37,36,0.88)'],
  ['rgba(82,82,91,0.94)', 'rgba(68,64,60,0.88)'],
  ['rgba(24,24,27,0.96)', 'rgba(168,162,158,0.72)'],
];

function ProductArtwork({ product }: { product: ProductView }) {
  const seed = Array.from(product.category + product.name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [from, to] = PRODUCT_ART_PALETTES[seed % PRODUCT_ART_PALETTES.length];

  return (
    <div
      className="product-artwork"
      style={{
        background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.34), transparent 8rem), linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      <div className="product-art-orb product-art-orb-one" />
      <div className="product-art-orb product-art-orb-two" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center text-white">
        <PackageSearch size={28} className="mb-2 opacity-80" />
        <div className="text-4xl font-black tracking-[-0.08em]">{productInitials(product.name)}</div>
        <div className="mt-2 max-w-[82%] truncate rounded-full bg-white/16 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/78">
          {product.category}
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ total, onClose, onComplete }: {
  total: number;
  onClose: () => void;
  onComplete: (method: PaymentMethod, amountTendered: number) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState(total.toString());
  const tenderNum = parseFloat(tendered) || 0;
  const change = tenderNum - total;
  const isInvalid = method === 'CASH' && tenderNum < total;
  const quickAmounts = useMemo(() => {
    const candidates = [
      total,
      Math.ceil(total / 20) * 20,
      Math.ceil(total / 50) * 50,
      Math.ceil(total / 100) * 100,
      50,
      100,
      200,
      500,
      1000,
    ].filter(amount => amount >= total);
    return Array.from(new Set(candidates)).slice(0, 5);
  }, [total]);
  const paymentMethods: Array<{ key: PaymentMethod; label: string; shortcut: string }> = [
    { key: 'CASH', label: 'Efectivo', shortcut: '1' },
    { key: 'CARD', label: 'Tarjeta', shortcut: '2' },
    { key: 'TRANSFER', label: 'Transferencia', shortcut: '3' },
  ];

  const submitPayment = useCallback(() => {
    if (!isInvalid) onComplete(method, tenderNum);
  }, [isInvalid, method, onComplete, tenderNum]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submitPayment();
      }
      if (!isEditableTarget(event.target)) {
        if (event.key === '1') {
          setMethod('CASH');
          setTendered(total.toString());
        }
        if (event.key === '2') {
          setMethod('CARD');
          setTendered(total.toString());
        }
        if (event.key === '3') {
          setMethod('TRANSFER');
          setTendered(total.toString());
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, submitPayment, total]);

  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="modal-card rounded-[30px] overflow-hidden w-full max-w-md transition-colors" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
        <div className="brand-panel p-7 text-white text-center transition-colors">
          <p id="payment-modal-title" className="text-[10px] uppercase tracking-[0.24em] font-black text-white/65 mb-2">Total a cobrar</p>
          <div className="text-5xl font-mono tracking-tight">{formatCurrency(total)}</div>
        </div>
        <div className="p-6 space-y-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => { setMethod(option.key); setTendered(total.toString()); }}
                className={`p-3 border rounded-2xl font-black transition-colors text-[10px] sm:text-xs ${method===option.key?'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300':'border-slate-200 dark:border-[#2D3139] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                {option.shortcut} {option.label}
              </button>
            ))}
          </div>
          {method === 'CASH' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTendered(amount.toString())}
                    className={`quick-cash ${tenderNum === amount ? 'quick-cash-active' : ''}`}
                  >
                    {amount === total ? 'Exacto' : formatCurrency(amount).replace('.00', '')}
                  </button>
                ))}
              </div>
              <input type="number" value={tendered} onChange={e => setTendered(e.target.value)} className="input-premium w-full text-right text-3xl font-mono p-4 outline-none text-slate-900 dark:text-white transition-colors" onFocus={(e) => e.currentTarget.select()}/>
              <div className={`payment-change ${isInvalid ? 'payment-change-error' : ''}`}>
                <span>{isInvalid ? 'Faltante' : 'Cambio'}</span>
                <span className="font-mono text-2xl">{formatCurrency(isInvalid ? Math.abs(change) : Math.max(change, 0))}</span>
              </div>
            </div>
          )}
          {method !== 'CASH' && (
            <div className="payment-change">
              <span>{method === 'CARD' ? 'Pago con tarjeta' : 'Transferencia SPEI'}</span>
              <span className="font-mono text-2xl">{formatCurrency(total)}</span>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={onClose} className="btn-secondary flex-1 py-4 text-xs">Cancelar</button>
            <button onClick={submitPayment} disabled={isInvalid} className="btn-primary flex-1 py-4 text-xs">Confirmar</button>
          </div>
          <p className="text-center text-[9px] uppercase tracking-[0.18em] font-black text-slate-400">1 efectivo · 2 tarjeta · 3 transferencia · Enter confirma</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. INVENTARIO
// ============================================================================

function InventoryView() {
  const { reqContext } = useAuth();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 140);
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [inventorySort, setInventorySort] = useState<{ key: InventorySortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [isEditing, setIsEditing] = useState<ProductFormData | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductView | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback(() => BackendAPI.getStoreProducts(reqContext).then(setProducts), [reqContext]);
  useEffect(() => {
    let active = true;
    BackendAPI.getStoreProducts(reqContext).then((data) => {
      if (active) setProducts(data);
    });
    return () => { active = false; };
  }, [reqContext]);

  const handleSave = async (data: CreateProductInput | UpdateProductInput) => {
    try {
      await BackendAPI.saveProduct(reqContext, data);
      await loadData();
      setIsEditing(null);
      setAlertInfo({ title: 'Éxito', message: 'El producto se guardó correctamente.' });
    } catch (error) {
      setAlertInfo({ title: 'Error', message: errorMessage(error, 'No se pudo guardar el producto') });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await BackendAPI.deleteProduct(reqContext, confirmDelete.id);
      await loadData();
      setConfirmDelete(null);
      setAlertInfo({ title: 'Producto Eliminado', message: 'El producto fue eliminado permanentemente.' });
    } catch (error) {
      setAlertInfo({ title: 'Error', message: errorMessage(error, 'No se pudo eliminar el producto') });
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkImport(false);
    setAlertInfo({ title: 'Inventario Importado', message: 'Los productos se importaron exitosamente.' });
    loadData();
  };

  const stockFilterOptions: Array<{ key: StockFilter; label: string; count: number }> = [
    { key: 'ALL', label: 'Todos', count: products.length },
    { key: 'LOW', label: 'Bajo stock', count: products.filter(product => product.stock > 0 && product.stock <= product.minStock).length },
    { key: 'OUT', label: 'Agotados', count: products.filter(product => product.stock <= 0).length },
  ];
  const toggleInventorySort = (key: InventorySortKey) => {
    setInventorySort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const sortMarker = (key: InventorySortKey) => {
    if (inventorySort.key !== key) return '';
    return inventorySort.direction === 'asc' ? ' ↑' : ' ↓';
  };
  const filtered = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    const result = products.filter(product => {
      const matchesQuery = !query
        || normalizeText(product.name).includes(query)
        || normalizeText(product.category).includes(query)
        || product.barcode.toLowerCase().includes(query);
      const matchesStock = stockFilter === 'ALL'
        || (stockFilter === 'LOW' && product.stock > 0 && product.stock <= product.minStock)
        || (stockFilter === 'OUT' && product.stock <= 0);
      return matchesQuery && matchesStock;
    });

    return [...result].sort((a, b) => {
      const direction = inventorySort.direction === 'asc' ? 1 : -1;
      if (inventorySort.key === 'price' || inventorySort.key === 'stock') {
        return (a[inventorySort.key] - b[inventorySort.key]) * direction;
      }
      return a[inventorySort.key].localeCompare(b[inventorySort.key]) * direction;
    });
  }, [debouncedSearch, inventorySort, products, stockFilter]);
  const inventoryValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);
  const lowStockCount = products.filter(product => product.stock > 0 && product.stock <= product.minStock).length;
  const outOfStockCount = products.filter(product => product.stock <= 0).length;

  return (
    <div className="view-shell p-4 lg:p-8 h-full flex flex-col relative text-slate-900 dark:text-[#E2E8F0] transition-colors">
      {confirmDelete && <ConfirmDialog title="Eliminar Objeto Maestro" message={`¿Confirmas la eliminación permanente del registro "${confirmDelete.name}"?`} onConfirm={executeDelete} onCancel={() => setConfirmDelete(null)} />}
      {alertInfo && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
      {isEditing && <ProductFormModal product={isEditing} onClose={() => setIsEditing(null)} onSave={handleSave} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={handleBulkSuccess} />}
      
      <div className="flex flex-col md:flex-row md:justify-between tracking-tight gap-4 mb-6 lg:mb-8">
        <div>
          <p className="section-kicker">Catalogo vivo</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-[-0.06em]">Maestro de Materiales ERP</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkImport(true)} className="btn-secondary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"><Upload size={18}/> Importar</button>
          <button onClick={() => setIsEditing({category: 'Abarrotes', stock: 0, minStock: 5})} className="btn-primary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"><Plus size={18}/> Crear Material</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="mini-metric">
          <p>Valor inventario</p>
          <strong>{formatCurrency(inventoryValue)}</strong>
        </div>
        <div className="mini-metric">
          <p>Productos</p>
          <strong>{products.length}</strong>
        </div>
        <div className="mini-metric">
          <p>Bajo stock</p>
          <strong>{lowStockCount}</strong>
        </div>
        <div className="mini-metric">
          <p>Agotados</p>
          <strong>{outOfStockCount}</strong>
        </div>
      </div>

      <div className="panel-card table-shell flex-1 overflow-hidden flex flex-col transition-colors">
        <div className="p-3 lg:p-4 border-b border-white/20 dark:border-white/10 transition-colors bg-white/35 dark:bg-black/10">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Filtrar por descripción, categoría o ID..." value={search} onChange={e => setSearch(e.target.value)} className="input-premium w-full pl-10 pr-4 py-3 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-colors"/>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stockFilterOptions.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStockFilter(option.key)}
                className={`stock-filter-chip ${stockFilter === option.key ? 'stock-filter-chip-active' : ''}`}
              >
                {option.label} <span>{option.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] text-slate-500 uppercase font-black tracking-[0.1em] sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-6 py-4">ID MATERIAL</th>
                <th className="px-6 py-4"><button type="button" onClick={() => toggleInventorySort('name')} className="table-sort-button">DESCRIPCIÓN{sortMarker('name')}</button></th>
                <th className="px-6 py-4"><button type="button" onClick={() => toggleInventorySort('price')} className="table-sort-button">PVP UNITARIO{sortMarker('price')}</button></th>
                <th className="px-6 py-4 text-center"><button type="button" onClick={() => toggleInventorySort('stock')} className="table-sort-button mx-auto">UBICACIÓN/STOCK{sortMarker('stock')}</button></th>
                <th className="px-6 py-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9d9d9] dark:divide-[#3a414a] transition-colors">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-slate-700 dark:text-slate-300">
                  <td className="px-6 py-4 font-mono text-slate-500">{p.barcode}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white uppercase">{p.name}</div>
                    <div className="text-[10px] font-bold text-[#0070b2] dark:text-blue-400">{p.category}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(p.price)}</td>
                  <td className="px-6 py-4 text-center" onDoubleClick={() => setIsEditing(p)} title="Doble clic para editar inventario">
                    <div className="flex items-center justify-center">
                      {p.stock <= 0 ? (
                        <span className="px-2 py-1 bg-red-600 text-white font-bold rounded-sm shadow-sm ring-1 ring-red-700">AGOTADO ({p.stock})</span>
                      ) : p.stock <= p.minStock ? (
                        <span className="px-2 py-1 bg-amber-500 text-white font-bold rounded-sm shadow-sm ring-1 ring-amber-600">CRÍTICO ({p.stock})</span>
                      ) : (
                        <span className="px-2 py-1 bg-[#1a2026] text-white dark:bg-white dark:text-black font-bold rounded-sm shadow-sm">
                          {p.stock} UDS
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => setIsEditing(p)} className="p-2 text-[#0070b2] hover:bg-white dark:hover:bg-black/20 rounded-full transition-colors"><Edit size={16}/></button>
                    <button onClick={() => setConfirmDelete(p)} className="p-2 text-[#ba1c1c] hover:bg-white dark:hover:bg-black/20 rounded-full transition-colors"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-black uppercase tracking-[0.16em]">
                    Sin productos para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface ProductFormData {
  id?: string;
  barcode?: string;
  name?: string;
  category?: string;
  cost?: number | string;
  price?: number | string;
  stock?: number | string;
  minStock?: number | string;
}

function ProductFormModal({ product, onClose, onSave }: {
  product: ProductFormData;
  onClose: () => void;
  onSave: (product: CreateProductInput | UpdateProductInput) => Promise<void>;
}) {
  const [data, setData] = useState<ProductFormData>(product);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading(true);
    const normalized = {
      barcode: data.barcode ?? '',
      name: data.name ?? '',
      category: data.category ?? '',
      cost: Number(data.cost),
      price: Number(data.price),
      stock: Number(data.stock),
      minStock: Number(data.minStock),
    };
    await onSave(data.id ? { ...normalized, id: data.id } : normalized);
    setLoading(false);
  }
  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="modal-card rounded-[30px] w-full max-w-xl p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <p className="section-kicker mb-2">{product.id ? 'Edicion' : 'Alta'}</p>
        <h2 id="product-form-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-[-0.04em] mb-4">{product.id ? 'Editar' : 'Nuevo'} Producto</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <input required placeholder="Código (ej. 12345)" value={data.barcode||''} onChange={e=>setData({...data, barcode: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required placeholder="Categoría (ej. General)" value={data.category||''} onChange={e=>setData({...data, category: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required placeholder="Nombre ('producto')" value={data.name||''} onChange={e=>setData({...data, name: e.target.value})} className="input-premium col-span-2 p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Costo proveedor" value={data.cost||''} onChange={e=>setData({...data, cost: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Venta publico" value={data.price||''} onChange={e=>setData({...data, price: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required type="number" placeholder="Items (Stock)" value={data.stock||0} onChange={e=>setData({...data, stock: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
          <input required type="number" placeholder="Min Stock" value={data.minStock||0} onChange={e=>setData({...data, minStock: e.target.value})} className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors" />
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-xs">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-xs">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { reqContext } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<CreateProductInput[] | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const [sheet] = await readXlsxFile(file);
      const [headerRow, ...rows] = sheet?.data ?? [];
      if (!headerRow || rows.length === 0) throw new Error('El archivo esta vacio o no contiene productos.');
      const headers = headerRow.map((value) => String(value ?? '').trim());

      const formattedProducts = rows.map((values, index): CreateProductInput => {
        const row = Object.fromEntries(headers.map((header, column) => [header, values[column]]));
        const name = String(row.producto ?? row.Producto ?? row.Name ?? '').trim();
        const cost = Number(row['Costo proveedor'] ?? row.Costo ?? row.cost ?? 0);
        const price = Number(row['Venta publico'] ?? row.Precio ?? row.price ?? 0);
        const stock = Number(row.Items ?? row.Stock ?? row.stock ?? 0);
        if (!name) throw new Error(`Fila ${index + 2}: El nombre del producto es obligatorio.`);

        return {
          name,
          cost,
          price,
          stock,
          minStock: 5,
          category: 'General',
          barcode: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
        };
      });

      setConfirmData(formattedProducts);
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Error al procesar el archivo Excel.'));
    } finally {
      setLoading(false);
    }
  };

  const processImport = async () => {
    if (!confirmData) return;
    try {
      setLoading(true);
      await BackendAPI.saveProductsBulk(reqContext, confirmData);
      onSuccess();
    } catch (importError) {
      setError(errorMessage(importError, 'Error al procesar el archivo Excel.'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {confirmData && (
        <ConfirmDialog 
          title="Confirmar Importación" 
          message={`¿Estás seguro de importar ${confirmData.length} productos a este catálogo?`} 
          onConfirm={processImport} 
          onCancel={() => setConfirmData(null)} 
        />
      )}
      <div className="modal-card rounded-[30px] w-full max-w-md p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors" role="dialog" aria-modal="true" aria-labelledby="bulk-import-title">
        <p className="section-kicker mb-2">Carga masiva</p>
        <h2 id="bulk-import-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-[-0.04em] mb-2">Importar Inventario</h2>
        <p className="text-sm text-slate-500 mb-6">Sube un archivo .xlsx con: <br/><strong>producto, Costo proveedor, Venta publico, Items</strong>.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${loading ? 'opacity-50 cursor-not-allowed border-slate-300' : 'border-blue-300 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/5 bg-slate-50 dark:bg-[#0F1115]'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-3 text-blue-500" />
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400 font-bold">{loading ? 'Procesando...' : 'Haz clic para seleccionar archivo'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">XLSX, XLS, CSV</p>
            </div>
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
          </label>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={onClose} disabled={loading} className="btn-secondary w-full py-3 text-xs">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. DASHBOARD Y REPORTES
// ============================================================================

function DashboardView() {
  const { reqContext } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [lastDashboardRefresh, setLastDashboardRefresh] = useState<Date | null>(null);
  const [period, setPeriod] = useState<SalesPeriod>('ALL');

  useEffect(() => {
    let active = true;
    const refreshDashboard = () => {
      Promise.all([
        BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }),
        BackendAPI.getStoreProducts(reqContext),
      ]).then(([salesData, productData]) => {
        if (!active) return;
        setSales(salesData);
        setProducts(productData);
        setLastDashboardRefresh(new Date());
      }).catch((error) => {
        if (active) console.error('No se pudo actualizar el dashboard', error);
      });
    };

    refreshDashboard();
    const interval = window.setInterval(refreshDashboard, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [reqContext]);

  const periodSales = useMemo(() => {
    const from = startOfPeriod(period);
    return sales.filter(sale => new Date(sale.datetime).getTime() >= from);
  }, [sales, period]);

  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = periodSales.reduce((sum, sale) => sum + (sale.items?.reduce((c, i) => c + (i.cost * i.quantity), 0) || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const iv = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

  // Data processing for Charts
  const salesByDate = useMemo(() => {
    const groups: Record<string, number> = {};
    periodSales.forEach(s => {
      const date = new Date(s.datetime).toLocaleDateString();
      groups[date] = (groups[date] || 0) + s.total;
    });
    return Object.entries(groups).map(([date, total]) => ({ date, total })).reverse();
  }, [periodSales]);

  const categoryMix = useMemo(() => {
    const cats: Record<string, number> = {};
    products.forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + (p.stock * p.price);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [products]);

  const COLORS = ['#27272a', '#52525b', '#78716c', '#a8a29e', '#d6d3d1'];
  const lowStockProducts = products
    .filter(product => product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);
  const highValueProducts = [...products]
    .sort((a, b) => (b.stock * b.price) - (a.stock * a.price))
    .slice(0, 5);
  const bestMarginProduct = [...products]
    .sort((a, b) => ((b.price - b.cost) / Math.max(b.price, 1)) - ((a.price - a.cost) / Math.max(a.price, 1)))[0];
  const topProducts = useMemo(() => {
    const groups: Record<string, { name: string; quantity: number; total: number }> = {};
    periodSales.forEach(sale => {
      sale.items?.forEach(item => {
        const current = groups[item.productId] ?? { name: item.name, quantity: 0, total: 0 };
        current.quantity += item.quantity;
        current.total += item.subtotal;
        groups[item.productId] = current;
      });
    });
    return Object.values(groups).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [periodSales]);
  const todayKey = new Date().toLocaleDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString();
  const todayRevenue = sales
    .filter(sale => new Date(sale.datetime).toLocaleDateString() === todayKey)
    .reduce((sum, sale) => sum + sale.total, 0);
  const yesterdayRevenue = sales
    .filter(sale => new Date(sale.datetime).toLocaleDateString() === yesterdayKey)
    .reduce((sum, sale) => sum + sale.total, 0);
  const revenueDelta = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  return (
    <div className="view-shell p-4 lg:p-8 h-full overflow-y-auto text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      <div className="panel-card command-header flex flex-col gap-4 p-5">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <p className="section-kicker">Inteligencia de negocio</p>
            <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-950 dark:text-white">Panel Ejecutivo</h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Lectura rapida de ingresos, utilidad, inventario y actividad comercial.</p>
          </div>
          <div className="status-chip text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-3 py-2">
             <TrendingUp size={12} /> Live Sync 60s {lastDashboardRefresh ? `- ${lastDashboardRefresh.toLocaleTimeString()}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400 inline-flex items-center gap-1"><CalendarDays size={12} /> Periodo</span>
          {PERIOD_OPTIONS.map(option => (
            <button key={option.key} type="button" onClick={() => setPeriod(option.key)} className={`stock-filter-chip ${period === option.key ? 'stock-filter-chip-active' : ''}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Ingresos Brutos" value={formatCurrency(totalRevenue)} icon={<Banknote size={24}/>} />
        <StatCard title="Margen de Utilidad" value={formatCurrency(totalProfit)} icon={<TrendingUp size={24}/>} />
        <StatCard title="Valuación Maestro" value={formatCurrency(iv)} icon={<PackageSearch size={24}/>} />
        <StatCard title="Transacciones" value={periodSales.length} icon={<Receipt size={24}/>} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="mini-metric">
          <p>Ingresos hoy</p>
          <strong>{formatCurrency(todayRevenue)}</strong>
        </div>
        <div className="mini-metric">
          <p>Dia anterior</p>
          <strong>{formatCurrency(yesterdayRevenue)}</strong>
        </div>
        <div className="mini-metric">
          <p>Variacion diaria</p>
          <strong>{revenueDelta === null ? 'N/D' : `${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(1)}%`}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="panel-card xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Tendencia de Ingresos</h3>
            <BarChart3 size={18} className="text-slate-400" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDate}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a2026', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Line type="monotone" dataKey="total" stroke="#3f3f46" strokeWidth={3} dot={{ fill: '#3f3f46', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Mix */}
        <div className="panel-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Distribución de Inventario</h3>
            <PieIcon size={18} className="text-slate-400" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryMix.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="panel-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-kicker">Prioridad de inventario</p>
              <h3 className="text-xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">Alertas Inteligentes</h3>
            </div>
            <AlertCircle className={lowStockProducts.length ? 'text-amber-500' : 'text-emerald-500'} />
          </div>
          <div className="space-y-3">
            {lowStockProducts.length ? lowStockProducts.map(product => (
              <div key={product.id} className="insight-row">
                <div>
                  <p className="font-black text-sm text-slate-900 dark:text-white">{product.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400">{product.category} · minimo {product.minStock}</p>
                </div>
                <span className="rounded-full bg-amber-500/12 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-300">{product.stock} uds</span>
              </div>
            )) : (
              <div className="empty-inline">
                <CheckCircle2 size={20} className="text-emerald-500" />
                Inventario dentro de rango operativo.
              </div>
            )}
          </div>
        </div>

        <div className="panel-card p-6">
          <p className="section-kicker">Margen estrella</p>
          <h3 className="text-xl font-black tracking-[-0.04em] text-slate-900 dark:text-white mb-5">Mejor Producto</h3>
          {bestMarginProduct ? (
            <div className="rounded-[24px] border border-teal-500/20 bg-teal-500/10 p-5">
              <p className="text-sm font-black text-slate-900 dark:text-white">{bestMarginProduct.name}</p>
              <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-teal-700 dark:text-teal-300">
                {(((bestMarginProduct.price - bestMarginProduct.cost) / Math.max(bestMarginProduct.price, 1)) * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400">margen estimado</p>
            </div>
          ) : (
            <div className="empty-inline">Sin productos cargados.</div>
          )}
        </div>
      </div>

      <div className="panel-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-kicker">Capital en anaquel</p>
            <h3 className="text-xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">Productos con Mayor Valor</h3>
          </div>
          <PackageSearch className="text-teal-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {highValueProducts.map(product => (
            <div key={product.id} className="rounded-[22px] border border-white/20 dark:border-white/10 bg-white/45 dark:bg-white/5 p-4">
              <p className="line-clamp-2 text-xs font-black text-slate-900 dark:text-white min-h-8">{product.name}</p>
              <p className="mt-3 text-lg font-black text-teal-700 dark:text-teal-300">{formatCurrency(product.stock * product.price)}</p>
              <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-slate-400">{product.stock} uds</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-kicker">Ranking comercial</p>
            <h3 className="text-xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">Top Productos Vendidos</h3>
          </div>
          <BarChart3 className="text-teal-500" />
        </div>
        <div className="space-y-3">
          {topProducts.length ? topProducts.map(item => {
            const maxTotal = Math.max(...topProducts.map(product => product.total));
            const width = maxTotal > 0 ? `${Math.max((item.total / maxTotal) * 100, 12)}%` : '12%';
            return (
              <div key={item.name} className="rounded-[22px] border border-white/20 dark:border-white/10 bg-white/45 dark:bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="line-clamp-1 text-xs font-black text-slate-900 dark:text-white">{item.name}</p>
                  <span className="text-xs font-black text-teal-700 dark:text-teal-300">{formatCurrency(item.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500" style={{ width }} />
                </div>
                <p className="mt-2 text-[9px] uppercase tracking-[0.16em] font-bold text-slate-400">{item.quantity} unidades vendidas</p>
              </div>
            );
          }) : (
            <div className="empty-inline">Aun no hay ventas con detalle para construir ranking.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="panel-card overflow-hidden">
            <div className="p-4 border-b border-white/20 dark:border-white/10 font-bold text-xs uppercase bg-white/35 dark:bg-black/10">Salud Operativa del Sistema</div>
            <div className="p-8 flex items-center gap-6">
               <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-[#0070b2]">
                  <ShieldCheck size={32} />
               </div>
               <div>
                  <h5 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">Núcleo Centralizado Activo</h5>
                  <p className="text-xs text-slate-500 mt-1">Sucursal: <span className="font-bold">{reqContext.storeId}</span>. Todos los servicios de auditoría y respaldo local están operativos.</p>
               </div>
            </div>
         </div>
         
         <div className="brand-panel rounded-[28px] p-6 text-white shadow-lg flex flex-col justify-between overflow-hidden">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest opacity-80">Rendimiento Estimado</h4>
              <p className="text-3xl font-black mt-2 tracking-tighter">
                {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-[10px] uppercase font-bold mt-1 opacity-70">Margen Bruto de Operación</p>
            </div>
            <div className="mt-4 flex gap-2">
               <div className="h-1 flex-1 bg-white/20 rounded overflow-hidden">
                  <div className="h-full bg-white rounded" style={{ width: `${totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0}%` }}></div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

function SalesView() {
  const { reqContext, store } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 140);
  const [period, setPeriod] = useState<SalesPeriod>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  useEffect(() => { BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales); }, [reqContext]);

  const filtered = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    const from = startOfPeriod(period);
    return sales.filter(sale => {
      const inPeriod = new Date(sale.datetime).getTime() >= from;
      const inMethod = methodFilter === 'ALL' || sale.paymentMethod === methodFilter;
      const matchesQuery = !query
        || sale.id.toLowerCase().includes(query)
        || normalizeText(PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod).includes(query)
        || (sale.items?.some(item => normalizeText(item.name).includes(query)) ?? false);
      return inPeriod && inMethod && matchesQuery;
    });
  }, [sales, debouncedSearch, period, methodFilter]);

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, sale) => sum + sale.total, 0);
    const items = filtered.reduce((sum, sale) => sum + sale.itemsCount, 0);
    return { count: filtered.length, total, items, avg: filtered.length ? total / filtered.length : 0 };
  }, [filtered]);

  const methodOptions: Array<{ key: 'ALL' | PaymentMethod; label: string }> = [
    { key: 'ALL', label: 'Todos' },
    { key: 'CASH', label: 'Efectivo' },
    { key: 'CARD', label: 'Tarjeta' },
    { key: 'TRANSFER', label: 'Transferencia' },
  ];

  const exportCsv = () => {
    const header = ['ID', 'Fecha', 'Metodo', 'Articulos', 'Total', 'Recibido', 'Cambio'];
    const lines = filtered.map(sale => [
      sale.id,
      new Date(sale.datetime).toLocaleString(),
      PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      sale.itemsCount,
      sale.total,
      sale.amountTendered,
      sale.changeAmount,
    ]);
    const csv = [header, ...lines].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    downloadTextFile(`ventas-${new Date().toISOString().slice(0, 10)}.csv`, String.fromCharCode(0xFEFF) + csv, 'text/csv;charset=utf-8;');
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full flex flex-col text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      {selectedReceipt && <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} storeName={store?.name ?? 'Sucursal'} />}
      <div className="panel-card command-header flex flex-col md:flex-row md:justify-between md:items-center gap-4 p-5">
         <div>
           <p className="section-kicker">Libro fiscal</p>
           <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white">Historico de Transacciones</h2>
           <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Filtra, revisa e imprime ventas con resumen del periodo.</p>
         </div>
         <button onClick={exportCsv} disabled={!filtered.length} className="btn-secondary flex items-center justify-center gap-2 px-4 py-3 text-xs">
           <Download size={16} /> Exportar CSV
         </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="mini-metric"><p>Transacciones</p><strong>{summary.count}</strong></div>
        <div className="mini-metric"><p>Ingreso del periodo</p><strong>{formatCurrency(summary.total)}</strong></div>
        <div className="mini-metric"><p>Ticket promedio</p><strong>{formatCurrency(summary.avg)}</strong></div>
        <div className="mini-metric"><p>Articulos vendidos</p><strong>{summary.items}</strong></div>
      </div>

      <div className="panel-card table-shell flex-1 overflow-hidden flex flex-col transition-colors">
        <div className="p-3 lg:p-4 border-b border-white/20 dark:border-white/10 bg-white/35 dark:bg-black/10 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por ticket, metodo o producto..." value={search} onChange={e => setSearch(e.target.value)} className="input-premium w-full pl-10 pr-4 py-3 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-colors" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400 inline-flex items-center gap-1"><CalendarDays size={12} /> Periodo</span>
            {PERIOD_OPTIONS.map(option => (
              <button key={option.key} type="button" onClick={() => setPeriod(option.key)} className={`stock-filter-chip ${period === option.key ? 'stock-filter-chip-active' : ''}`}>
                {option.label}
              </button>
            ))}
            <span className="mx-1 hidden sm:inline-block w-px h-4 bg-slate-300 dark:bg-white/10" />
            {methodOptions.map(option => (
              <button key={option.key} type="button" onClick={() => setMethodFilter(option.key)} className={`stock-filter-chip ${methodFilter === option.key ? 'stock-filter-chip-active' : ''}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr><th className="px-6 py-4">UUID TRANSACCIÓN</th><th className="px-6 py-4">MARCA DE TIEMPO</th><th className="px-6 py-4">MÉTODO PAGO</th><th className="px-6 py-4 text-right">VALOR NETO</th><th className="px-6 py-4 text-center">UM</th><th className="px-6 py-4 text-center">ACCIONES</th></tr>
            </thead>
            <tbody className="divide-y divide-[#d9d9d9] dark:divide-[#3a414a] transition-colors">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-slate-700 dark:text-slate-300">
                  <td className="px-6 py-4 font-mono text-slate-500 text-[10px]">{s.id}</td>
                  <td className="px-6 py-4 font-semibold">{new Date(s.datetime).toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-[#0070b2] dark:text-blue-400 uppercase tracking-tighter">{PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(s.total)}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-500">{s.itemsCount} LIN</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => setSelectedReceipt(s)} className="p-2 text-[#0070b2] hover:bg-white dark:hover:bg-black/20 rounded-full transition-colors"><Printer size={16}/></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-black uppercase tracking-[0.16em]">
                    Sin transacciones para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MovementsView() {
  const { reqContext } = useAuth();
  const [moves, setMoves] = useState<StockMovementView[]>([]);
  useEffect(() => { BackendAPI.getStockMovements({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setMoves); }, [reqContext]);
  
  return (
    <div className="view-shell p-4 lg:p-8 h-full flex flex-col text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      <div>
        <p className="section-kicker">Trazabilidad</p>
        <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">Libro de Logistica y Auditoria</h2>
      </div>
      <div className="panel-card flex-1 p-6 flex flex-col gap-4 overflow-y-auto transition-colors">
        {moves.map(m => (
          <div key={m.id} className="flex gap-4 group">
            <div className={`w-1 rounded-full ${m.quantity > 0 ? 'bg-[#0070b2]' : 'bg-[#ba1c1c]'}`}></div>
            <div className="flex-1 border-b border-[#f3f5f6] dark:border-[#1a2026] pb-4 transition-colors">
              <div className="text-[10px] font-black uppercase text-[#0070b2]/70 tracking-tight mb-1">{m.type} MATERIAL #{m.id}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-white transition-colors">
                {m.productName} adjusted by <span className={m.quantity > 0 ? 'text-[#0070b2]' : 'text-[#ba1c1c]'}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span> units
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mt-2">Usuario: {m.userName} • Fecha: {new Date(m.date).toLocaleString()} • Motivo: {m.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES COMUNES
// ============================================================================

function ReceiptModal({ sale, storeName, onClose }: { sale: Sale; storeName: string; onClose: () => void }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 print:p-0 print:bg-white transition-opacity">
      <div className="flex gap-4 mb-6 no-print flex-col sm:flex-row w-full sm:w-auto">
        <button onClick={handlePrint} className="bg-[#0070b2] hover:bg-[#005a8f] text-white font-bold py-3 px-8 rounded flex items-center justify-center gap-2 shadow-xl transition-all uppercase tracking-widest text-xs border border-white/10"><Printer size={18}/> Imprimir</button>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded flex items-center justify-center gap-2 transition-colors border border-white/10 uppercase tracking-widest text-xs">Cerrar</button>
      </div>
      
      <div className="receipt-paper relative bg-[#faf9f6] text-slate-900 w-full max-w-[340px] flex-col overflow-visible shadow-2xl print:shadow-none print:w-full drop-shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
         <div className="p-8 pb-12 flex flex-col items-center relative z-10 bg-[#faf9f6]">
             <div className="w-14 h-14 bg-[#0070b2] text-white rounded-full flex items-center justify-center mb-4 shadow"><StoreIcon size={28}/></div>
             <h2 id="receipt-title" className="font-extrabold text-2xl tracking-tighter uppercase mb-1 text-[#0070b2] text-center leading-none">EL TRIUNFO ERP</h2>
             <p className="text-slate-500 text-[10px] font-mono mb-6 uppercase tracking-[0.2em] text-center">Sucursal {storeName || 'S001'}</p>
             
             <div className="w-full space-y-2 mb-6 text-[11px] font-mono border-y border-dashed border-slate-300 py-4">
                <div className="flex justify-between text-slate-500"><span>FECHA</span><span className="text-slate-800">{new Date(sale.datetime).toLocaleString()}</span></div>
                <div className="flex justify-between text-slate-500"><span>TICKET #</span><span className="text-slate-900 font-bold">{sale.id}</span></div>
                <div className="flex justify-between text-slate-500"><span>MÉTODO</span><span className="text-slate-900 font-bold uppercase">{sale.paymentMethod}</span></div>
             </div>

             <div className="w-full">
                <table className="w-full text-sm font-mono leading-tight mb-4 text-slate-800">
                  <thead><tr className="border-b border-slate-800 text-left"><th className="pb-1 font-normal w-12">CANT</th><th className="pb-1 font-normal">ARTÍCULO</th><th className="pb-1 font-normal text-right">IMPORTE</th></tr></thead>
                  <tbody>
                    {sale.items?.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="py-2 pr-2">{item.quantity}</td>
                        <td className="py-2 pr-2">
                          <span className="uppercase">{item.name}</span>
                          <span className="block text-[10px] text-slate-500">{formatCurrency(item.price)} c/u</span>
                        </td>
                        <td className="py-2 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>

             <div className="w-full flex flex-col gap-1 text-sm font-mono border-t border-slate-800 pt-3">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>ARTÍCULOS</span><span className="text-slate-800">{sale.itemsCount}</span>
                </div>
                <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-300">
                  <span className="font-bold text-slate-800 tracking-widest uppercase">TOTAL</span>
                  <span className="font-black text-3xl tracking-tighter text-emerald-600">{formatCurrency(sale.total)}</span>
                </div>
                {sale.paymentMethod === 'CASH' && sale.amountTendered > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-1 text-[12px]">
                    <div className="flex justify-between text-slate-500"><span>RECIBIDO</span><span className="text-slate-800 font-bold">{formatCurrency(sale.amountTendered)}</span></div>
                    <div className="flex justify-between text-slate-500"><span>CAMBIO</span><span className="text-slate-800 font-bold">{formatCurrency(sale.changeAmount)}</span></div>
                  </div>
                )}
             </div>

             <div className="mt-10 flex flex-col items-center border-t border-dashed border-slate-300 pt-6 w-full">
                <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mb-4"><QrCode size={48} strokeWidth={1} className="text-slate-800"/></div>
                <p className="text-[10px] text-slate-500 font-mono tracking-widest text-center uppercase leading-relaxed font-bold">¡Gracias por tu compra!</p>
             </div>
         </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="modal-card p-6 rounded-[28px] w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] transition-colors" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h3 id="confirm-dialog-title" className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="btn-secondary flex-1 py-3 text-xs">Cancelar</button>
          <button onClick={onConfirm} className="btn-primary flex-1 py-3 text-xs">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function AlertDialog({ title, message, onClose }: { title: string, message: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="modal-card p-6 rounded-[28px] w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] text-center transition-colors" role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title">
        <div className="flex justify-center mb-4 text-emerald-500"><CheckCircle2 size={48} /></div>
        <h3 id="alert-dialog-title" className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <button onClick={onClose} className="btn-primary w-full py-3 text-xs">Aceptar</button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`nav-link w-full flex items-center gap-3 px-3.5 py-3 font-bold text-sm transition-all ${active ? 'nav-link-active' : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'}`}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: React.ReactNode }) {
  return (
    <div className="metric-card p-6 flex flex-col justify-between transition-colors">
      <div className="relative z-10 text-[11px] uppercase font-black text-slate-400 tracking-[0.18em] mb-3 flex items-center justify-between">
        {title}
        <div className="p-2 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300">{icon}</div>
      </div>
      <h4 className="relative z-10 text-3xl font-mono font-black text-slate-800 dark:text-white tracking-tighter">{value}</h4>
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppTheme();
  return (
    <button onClick={theme.toggleTheme} className="btn-secondary px-4 py-3 text-xs">
      {theme.isDark ? <Sun size={20}/> : <Moon size={20}/>}
    </button>
  );
}

function CorteCajaView({ onShiftClosed }: { onShiftClosed: () => void }) {
  const { reqContext } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [countedCash, setCountedCash] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([BackendAPI.getActiveShift(reqContext), BackendAPI.getShifts(reqContext)]).then(([current, history]) => {
      if (!active) return;
      setActiveShift(current);
      setShifts(history);
    });
    return () => { active = false; };
  }, [reqContext]);

  const handleClose = async () => {
    if (!activeShift) return;
    setLoading(true);
    try {
      await BackendAPI.closeShift(reqContext, parseFloat(countedCash) || 0);
      onShiftClosed();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo cerrar el turno'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full overflow-y-auto text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      <div>
        <p className="section-kicker">Caja segura</p>
        <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">Control de Efectivo y Turnos</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Shift Card */}
        <div className="panel-card xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#0070b2]">Turno Actual en Operación</h3>
            <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">Activo</span>
          </div>
          
          {activeShift ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Fondo Inicial</p>
                <p className="text-2xl font-mono font-bold">{formatCurrency(activeShift.initialCash)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas Efectivo (+)</p>
                <p className="text-2xl font-mono font-bold text-emerald-600">+{formatCurrency(activeShift.salesCash)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas Tarjeta (Ref)</p>
                <p className="text-2xl font-mono font-bold text-blue-500">{formatCurrency(activeShift.salesCard)}</p>
              </div>
              
              <div className="md:col-span-3 pt-6 border-t border-dashed border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Efectivo Esperado en Caja</p>
                  <p className="text-4xl font-black tracking-tighter text-[#0070b2] dark:text-blue-400">{formatCurrency(activeShift.expectedCash)}</p>
                </div>
                
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      placeholder="Dinero físico contado..." 
                      className="input-premium w-full md:w-64 pl-8 pr-4 py-3 font-bold text-lg outline-none"
                      value={countedCash}
                      onChange={e => setCountedCash(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleClose}
                    disabled={loading || !countedCash}
                    className="btn-danger w-full py-3 text-xs disabled:opacity-50"
                  >
                    {loading ? 'Procesando...' : 'Cerrar Turno y Arqueo'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center opacity-50">Cargando datos del turno...</div>
          )}
        </div>

        {/* Quick Info */}
        <div className="space-y-6">
          <div className="panel-card p-6">
             <div className="flex items-center gap-3 mb-4">
                <Landmark className="text-[#0070b2]" />
                <h4 className="font-bold text-xs uppercase">Resumen de Seguridad</h4>
             </div>
             <p className="text-xs text-slate-500 leading-relaxed">
               El cierre de turno es una operación crítica. Asegúrate de contar todas las denominaciones antes de ingresar el monto final. Las diferencias mayores a $50.00 dispararán una alerta administrativa.
             </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="panel-card table-shell overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/20 dark:border-white/10 font-bold text-xs uppercase bg-white/35 dark:bg-black/10">Historial de Cortes de Caja</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-6 py-4">ID TURNO</th>
                <th className="px-6 py-4">APERTURA</th>
                <th className="px-6 py-4">CIERRE</th>
                <th className="px-6 py-4 text-right">ESPERADO</th>
                <th className="px-6 py-4 text-right">REAL</th>
                <th className="px-6 py-4 text-center">DIFERENCIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9d9d9] dark:divide-[#3a414a]">
              {shifts.filter(s => s.status === 'CLOSED').map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-slate-300">
                  <td className="px-6 py-4 font-mono text-slate-500">{s.id}</td>
                  <td className="px-6 py-4">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="px-6 py-4">{s.endTime ? new Date(s.endTime).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-right font-bold">{formatCurrency(s.expectedCash)}</td>
                  <td className="px-6 py-4 text-right font-bold">{formatCurrency(s.actualCash || 0)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-sm font-bold shadow-sm ${Math.abs(s.difference || 0) < 1 ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'}`}>
                      {formatCurrency(s.difference || 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OpenShiftModal({ onOpen }: { onOpen: (s: Shift) => void }) {
  const { reqContext } = useAuth();
  const [initialCash, setInitialCash] = useState('500');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const shift = await BackendAPI.openShift(reqContext, parseFloat(initialCash) || 0);
      onOpen(shift);
    } catch (error) {
      alert(errorMessage(error, 'No se pudo abrir el turno'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="modal-card p-8 rounded-[30px] w-full max-w-md transition-colors" role="dialog" aria-modal="true" aria-labelledby="open-shift-title">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="brand-panel w-16 h-16 text-white rounded-3xl flex items-center justify-center mb-4 shadow-2xl">
            <ArrowDownCircle size={32} />
          </div>
          <h2 id="open-shift-title" className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Apertura de Turno SAP</h2>
          <p className="text-sm text-slate-500 mt-2">No hay un turno activo para tu usuario. Ingresa el fondo de caja inicial para comenzar a operar.</p>
        </div>
        
        <div className="space-y-4 mb-8">
           <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Fondo de Caja (MXN)</label>
           <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-300">$</span>
              <input 
                required 
                type="number" 
                className="input-premium w-full pl-10 pr-4 py-4 text-3xl font-mono font-bold text-teal-700 dark:text-teal-300 outline-none"
                value={initialCash}
                onChange={e => setInitialCash(e.target.value)}
                autoFocus
                onFocus={e => e.target.select()}
              />
           </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary w-full py-4 text-sm active:scale-[0.98]"
        >
          {loading ? 'Iniciando Turno...' : 'Comenzar Operaciones'}
        </button>
        
        <div className="mt-6 text-center">
           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Protocolo de Seguridad Financiera v2.0</p>
        </div>
      </form>
    </div>
  );
}

function ClientsView() {
  const { reqContext } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClients = useCallback(async () => {
    const data = await BackendAPI.getClients(reqContext);
    setClients(data);
  }, [reqContext]);

  useEffect(() => {
    let active = true;
    BackendAPI.getClients(reqContext).then((data) => {
      if (active) setClients(data);
    });
    return () => { active = false; };
  }, [reqContext]);

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.taxId?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await BackendAPI.saveClient(reqContext, editingClient!);
      setEditingClient(null);
      loadClients();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo guardar el cliente'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    await BackendAPI.deleteClient(reqContext, id);
    loadClients();
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full overflow-y-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="section-kicker">CRM compacto</p>
          <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-[#0070b2]" /> Directorio de Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">Gestión de cartera y lealtad</p>
        </div>
        <button 
          onClick={() => setEditingClient({ name: '', email: '', phone: '', taxId: '' })}
          className="btn-primary px-6 py-3 text-xs flex items-center gap-2"
        >
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="panel-card p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, RFC o teléfono..." 
            className="input-premium w-full pl-10 pr-4 py-3 font-bold text-sm outline-none transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="panel-card table-shell overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[800px]">
            <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-6 py-4">CLIENTE</th>
                <th className="px-6 py-4">CONTACTO</th>
                <th className="px-6 py-4">RFC / TAX ID</th>
                <th className="px-6 py-4 text-center">PUNTOS</th>
                <th className="px-6 py-4 text-right">TOTAL COMPRADO</th>
                <th className="px-6 py-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9d9d9] dark:divide-[#3a414a]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-slate-300">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center font-bold text-[#0070b2]">
                        {c.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white uppercase">{c.name}</p>
                        <p className="text-[9px] text-slate-400">ID: {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {c.email && <div className="flex items-center gap-1"><Mail size={10} className="text-slate-400" /> {c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1"><Phone size={10} className="text-slate-400" /> {c.phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-500">
                    {c.taxId || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-[#0070b2] rounded font-bold">
                      {c.points} pts
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
                    {formatCurrency(c.totalSpent)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setEditingClient(c)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 rounded transition-all">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="modal-card w-full max-w-md rounded-[30px] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
            <div className="brand-panel p-6 flex justify-between items-center text-white">
              <h3 id="client-form-title" className="font-black text-sm uppercase tracking-widest">
                {editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente CRM'}
              </h3>
              <button onClick={() => setEditingClient(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nombre Completo</label>
                <div className="relative">
                   <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input 
                     required 
                     className="input-premium w-full pl-10 pr-4 py-3 font-bold outline-none"
                     value={editingClient.name}
                     onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                   />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">RFC / TAX ID</label>
                  <input 
                    className="input-premium w-full px-4 py-3 font-bold outline-none"
                    value={editingClient.taxId}
                    onChange={e => setEditingClient({...editingClient, taxId: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Teléfono</label>
                  <input 
                    className="input-premium w-full px-4 py-3 font-bold outline-none"
                    value={editingClient.phone}
                    onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Email</label>
                <input 
                  type="email"
                  className="input-premium w-full px-4 py-3 font-bold outline-none"
                  value={editingClient.email}
                  onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full py-4 text-xs"
                >
                  {loading ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
