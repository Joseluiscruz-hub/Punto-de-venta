import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  ShoppingCart, LayoutDashboard, PackageSearch, Receipt, LogOut, 
  Plus, Search, Trash2, Edit, Barcode, Banknote,
  TrendingUp, AlertCircle, CheckCircle2, UserCog, ShieldCheck,
  History, X, Store as StoreIcon, Sun, Moon, Upload, Menu,
  Printer, QrCode, CloudUpload, WifiOff, BarChart3, PieChart as PieIcon,
  Wallet, Landmark, ArrowDownCircle, Users, Mail, Phone
} from 'lucide-react';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';

import {
  Tenant, Store, User, Product, StoreProduct, SaleItem, Sale, StockMovement,
  ProductView, StockMovementView, RequestContext,
  CreateProductInput, UpdateProductInput, ProcessSaleInput, LoginResponse,
  Feature, Role, PaymentMethod, Shift, Client
} from './models/types';

// ============================================================================
// 1. UTILIDADES Y CONSTANTES
// ============================================================================

function hasFeature(tenant: Tenant | null, feature: Feature) {
  if (!tenant) return false;
  const planFeatures = {
    BASIC: ['POS', 'INVENTORY'],
    PRO: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT'],
    PREMIUM: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT', 'OFFLINE', 'API'],
  };
  return (planFeatures[tenant.plan] as any)?.includes(feature) ?? false;
}

// ============================================================================
// 2. CAPA DE INFRAESTRUCTURA (Simulación de Backend)
// ============================================================================

let DB = {
  tenants: [
    { id: 't1', name: 'Mi Empresa SA', plan: 'PREMIUM' } as Tenant
  ],
  stores: [
    { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' } as Store,
    { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' } as Store,
  ],
  users: [
    { id: 'u1', tenantId: 't1', storeId: 's1', username: 'admin', name: 'Administrador', role: 'ADMIN' },
    { id: 'u2', tenantId: 't1', storeId: 's1', username: 'caja1', name: 'Juan Pérez', role: 'CASHIER' }
  ] as User[],
  products: [
    { id: 'p1', tenantId: 't1', barcode: '75010001', name: 'Leche Entera Alpura 1L', category: 'Lácteos', cost: 18.5, price: 25.0 },
    { id: 'p2', tenantId: 't1', barcode: '75010002', name: 'Pan Bimbo Blanco', category: 'Panadería', cost: 30.0, price: 42.0 },
    { id: 'p3', tenantId: 't1', barcode: '75010003', name: 'Coca-Cola 600ml', category: 'Bebidas', cost: 11.0, price: 18.0 },
  ] as Product[],
  storeProducts: [
    { id: 'sp1', tenantId: 't1', storeId: 's1', productId: 'p1', stock: 45, minStock: 10 },
    { id: 'sp2', tenantId: 't1', storeId: 's1', productId: 'p2', stock: 12, minStock: 15 },
    { id: 'sp3', tenantId: 't1', storeId: 's1', productId: 'p3', stock: 120, minStock: 24 },
  ] as StoreProduct[],
  sales: [] as Sale[],
  saleItems: [] as SaleItem[],
  movements: [] as StockMovement[],
  shifts: [] as Shift[],
  clients: [
    { id: 'c1', tenantId: 't1', name: 'Publico General', points: 0, totalSpent: 0 },
    { id: 'c2', tenantId: 't1', name: 'Juan Cliente Especial', email: 'juan@mail.com', points: 150, totalSpent: 1250 }
  ] as Client[]
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const BackendAPI = {
  async login(username: string, pin: string): Promise<LoginResponse> {
    await delay(300);
    const user = DB.users.find(u => u.username === username);
    if (user && ((username === 'admin' && pin === '1234') || (username === 'caja1' && pin === '0000'))) {
      const tenant = DB.tenants.find(t => t.id === user.tenantId)!;
      const store = DB.stores.find(s => s.id === user.storeId)!;
      return { user, tenant, store, token: 'simulated_jwt_token' };
    }
    throw new Error('Credenciales inválidas');
  },

  async deleteProduct(context: RequestContext, productId: string): Promise<void> {
    await delay(300);
    DB.products = DB.products.filter(p => !(p.id === productId && p.tenantId === context.tenantId));
    DB.storeProducts = DB.storeProducts.filter(sp => !(sp.productId === productId && sp.tenantId === context.tenantId));
  },

  async getStoreProducts(context: RequestContext): Promise<ProductView[]> {
    await delay(200);
    const tProducts = DB.products.filter(p => p.tenantId === context.tenantId);
    const sproducts = DB.storeProducts.filter(sp => sp.tenantId === context.tenantId && sp.storeId === context.storeId);
    
    return tProducts.map(p => {
      const sp = sproducts.find(s => s.productId === p.id);
      return {
        ...p,
        stock: sp ? sp.stock : 0,
        minStock: sp ? sp.minStock : 0
      };
    });
  },

  async saveProduct(context: RequestContext, productData: CreateProductInput | UpdateProductInput): Promise<ProductView> {
    await delay(300);
    const isNew = !('id' in productData) || !productData.id;
    
    if (isNew) {
      const newProduct: Product = {
        id: `p${Date.now()}`,
        tenantId: context.tenantId,
        barcode: productData.barcode,
        name: productData.name,
        category: productData.category,
        cost: productData.cost,
        price: productData.price
      };
      DB.products.push(newProduct);
      
      const newSp: StoreProduct = {
        id: `sp${Date.now()}`,
        tenantId: context.tenantId,
        storeId: context.storeId,
        productId: newProduct.id,
        stock: productData.stock,
        minStock: productData.minStock
      };
      DB.storeProducts.push(newSp);

      if (newSp.stock > 0) {
        DB.movements.push({
          id: `m${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: newProduct.id, userId: context.userId, type: 'PURCHASE',
          quantity: newSp.stock, date: new Date().toISOString(), reason: 'Inventario Inicial'
        });
      }
      return { ...newProduct, stock: newSp.stock, minStock: newSp.minStock };
    } else {
      const pId = (productData as any).id;
      const indexP = DB.products.findIndex(p => p.id === pId && p.tenantId === context.tenantId);
      if (indexP === -1) throw new Error('Producto no encontrado');
      
      DB.products[indexP] = { 
        ...DB.products[indexP], 
        barcode: productData.barcode, name: productData.name, category: productData.category,
        cost: productData.cost, price: productData.price
      };

      let spIndex = DB.storeProducts.findIndex(sp => sp.productId === pId && sp.storeId === context.storeId && sp.tenantId === context.tenantId);
      
      if (spIndex === -1) {
         // Create if missing for this store
         const newSp: StoreProduct = {
          id: `sp${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: pId, stock: productData.stock, minStock: productData.minStock
        };
        DB.storeProducts.push(newSp);
        spIndex = DB.storeProducts.length - 1;
      }
      
      const oldStock = DB.storeProducts[spIndex].stock;
      DB.storeProducts[spIndex] = { ...DB.storeProducts[spIndex], stock: productData.stock, minStock: productData.minStock };

      if (oldStock !== productData.stock) {
        DB.movements.push({
          id: `m${Date.now()}`, tenantId: context.tenantId, storeId: context.storeId,
          productId: pId, userId: context.userId, type: 'ADJUSTMENT',
          quantity: productData.stock - oldStock, date: new Date().toISOString(), reason: 'Ajuste manual'
        });
      }

      return { ...DB.products[indexP], stock: productData.stock, minStock: productData.minStock };
    }
  },

  async saveProductsBulk(context: RequestContext, productsData: CreateProductInput[]): Promise<void> {
    await delay(500);
    for (const data of productsData) {
      await this.saveProduct(context, data);
    }
  },

  async processSale(context: RequestContext, saleData: ProcessSaleInput): Promise<Sale> {
    await delay(400);
    
    if (!saleData.isOfflineSync) {
      for (const item of saleData.items) {
        const sp = DB.storeProducts.find(sp => sp.productId === item.id && sp.storeId === context.storeId && sp.tenantId === context.tenantId);
        if (!sp || sp.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
      }
    }

    const total = saleData.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    
    const newSale: Sale = {
      id: `TRX-${Date.now().toString().slice(-6)}`,
      tenantId: context.tenantId,
      storeId: context.storeId,
      cashierId: context.userId,
      clientId: saleData.clientId,
      datetime: saleData.offlineDate || new Date().toISOString(),
      total,
      paymentMethod: saleData.paymentMethod,
      amountTendered: saleData.amountTendered,
      changeAmount: saleData.amountTendered - total,
      itemsCount: saleData.items.reduce((acc, i) => acc + i.quantity, 0)
    };
    DB.sales.push(newSale);

    // Update Client Loyalty
    if (saleData.clientId) {
      const client = DB.clients.find(c => c.id === saleData.clientId && c.tenantId === context.tenantId);
      if (client) {
        client.points += Math.floor(total * 0.01); // 1% points
        client.totalSpent += total;
        client.lastVisit = newSale.datetime;
      }
    }

    saleData.items.forEach(item => {
      const saleItem: SaleItem = {
        id: `si${Date.now()}${Math.random()}`,
        saleId: newSale.id,
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost,
        subtotal: item.price * item.quantity
      };
      DB.saleItems.push(saleItem);

      const sp = DB.storeProducts.find(sp => sp.productId === item.id && sp.storeId === context.storeId && sp.tenantId === context.tenantId)!;
      sp.stock -= item.quantity;

      DB.movements.push({
        id: `m${Date.now()}-${item.id}`,
        tenantId: context.tenantId,
        storeId: context.storeId,
        productId: item.id,
        userId: context.userId,
        type: 'SALE',
        quantity: -item.quantity,
        date: newSale.datetime,
        reason: `Venta ${newSale.id}`
      });
    });

    // Update Shift Totals
    const activeShift = DB.shifts.find(s => s.status === 'OPEN' && s.userId === context.userId && s.storeId === context.storeId);
    if (activeShift) {
      if (saleData.paymentMethod === 'CASH') {
        activeShift.salesCash += total;
        activeShift.expectedCash += total;
      } else {
        activeShift.salesCard += total;
      }
    }

    return newSale;
  },

  async getActiveShift(context: RequestContext): Promise<Shift | null> {
    await delay(100);
    return DB.shifts.find(s => s.status === 'OPEN' && s.userId === context.userId && s.storeId === context.storeId) || null;
  },

  async openShift(context: RequestContext, initialCash: number): Promise<Shift> {
    await delay(200);
    const newShift: Shift = {
      id: `SHIFT-${Date.now().toString().slice(-6)}`,
      tenantId: context.tenantId,
      storeId: context.storeId,
      userId: context.userId,
      startTime: new Date().toISOString(),
      initialCash,
      expectedCash: initialCash,
      status: 'OPEN',
      salesCash: 0,
      salesCard: 0,
      cashOut: 0
    };
    DB.shifts.push(newShift);
    return newShift;
  },

  async closeShift(context: RequestContext, actualCash: number): Promise<Shift> {
    await delay(300);
    const shiftIndex = DB.shifts.findIndex(s => s.status === 'OPEN' && s.userId === context.userId && s.storeId === context.storeId);
    if (shiftIndex === -1) throw new Error('No hay un turno activo para cerrar');

    const shift = DB.shifts[shiftIndex];
    shift.status = 'CLOSED';
    shift.endTime = new Date().toISOString();
    shift.actualCash = actualCash;
    shift.difference = actualCash - shift.expectedCash;

    return shift;
  },

  async getShifts(context: RequestContext): Promise<Shift[]> {
    await delay(200);
    return DB.shifts.filter(s => s.tenantId === context.tenantId && s.storeId === context.storeId)
             .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  },

  async getClients(context: Pick<RequestContext, 'tenantId'>): Promise<Client[]> {
    await delay(200);
    return DB.clients.filter(c => c.tenantId === context.tenantId);
  },

  async saveClient(context: Pick<RequestContext, 'tenantId'>, clientData: Partial<Client>): Promise<Client> {
    await delay(300);
    if (clientData.id) {
      const idx = DB.clients.findIndex(c => c.id === clientData.id && c.tenantId === context.tenantId);
      if (idx === -1) throw new Error('Cliente no encontrado');
      DB.clients[idx] = { ...DB.clients[idx], ...clientData };
      return DB.clients[idx];
    } else {
      const newClient: Client = {
        id: `c${Date.now()}`,
        tenantId: context.tenantId,
        name: clientData.name!,
        email: clientData.email,
        phone: clientData.phone,
        taxId: clientData.taxId,
        points: 0,
        totalSpent: 0
      };
      DB.clients.push(newClient);
      return newClient;
    }
  },

  async deleteClient(context: Pick<RequestContext, 'tenantId'>, clientId: string): Promise<void> {
    await delay(200);
    DB.clients = DB.clients.filter(c => !(c.id === clientId && c.tenantId === context.tenantId));
  },

  async getSales(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<Sale[]> {
    await delay(200);
    let s = DB.sales.filter(s => s.tenantId === context.tenantId);
    if (context.storeId) s = s.filter(x => x.storeId === context.storeId);
    
    return s.sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).map(sale => {
      const items = DB.saleItems.filter(si => si.saleId === sale.id).map(si => ({
        ...si,
        name: DB.products.find(p => p.id === si.productId)?.name || 'Desconocido'
      }));
      return { ...sale, items };
    });
  },

  async getStockMovements(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<StockMovementView[]> {
    await delay(200);
    let m = DB.movements.filter(m => m.tenantId === context.tenantId);
    if (context.storeId) m = m.filter(x => x.storeId === context.storeId);
    
    return m.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(mov => ({
      ...mov,
      productName: DB.products.find(p => p.id === mov.productId)?.name || 'N/A',
      userName: DB.users.find(u => u.id === mov.userId)?.name || 'N/A'
    }));
  }
};

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
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
  const [session, setSession] = useState<{ user: User, tenant: Tenant, store: Store, token: string } | null>(null);
  const themeData = useThemeProvider();
  
  const login = async (username: string, pin: string) => {
    const data = await BackendAPI.login(username, pin);
    setSession(data);
  };
  
  const logout = () => setSession(null);
  
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

function SyncManager() {
  const { tenant } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const checkPending = () => {
    const existingStr = localStorage.getItem('offline_sales') || '[]';
    const existing = JSON.parse(existingStr);
    setPendingCount(existing.length);
  };

  useEffect(() => {
    checkPending();
    const handleOnline = () => { setIsOnline(true); checkPending(); };
    const handleOffline = () => setIsOnline(false);
    
    const interval = setInterval(checkPending, 5000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && hasFeature(tenant, 'OFFLINE')) {
      syncSales();
    }
  }, [isOnline, pendingCount, tenant]);

  const syncSales = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const existingStr = localStorage.getItem('offline_sales') || '[]';
      const existing = JSON.parse(existingStr);
      
      const failed = [];
      for (const record of existing) {
         try {
            await BackendAPI.processSale(record.reqContext, record.saleData);
         } catch (e) {
            console.error("Error syncing sale:", e);
            failed.push(record);
         }
      }
      localStorage.setItem('offline_sales', JSON.stringify(failed));
      setPendingCount(failed.length);
    } finally {
      setIsSyncing(false);
    }
  };

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
  const [currentView, setCurrentView] = useState<'pos' | 'dashboard' | 'inventory' | 'sales' | 'movements' | 'corte' | 'clients'>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  
  useEffect(() => {
    BackendAPI.getActiveShift(reqContext).then(shift => {
      if (!shift) setShowOpenShiftModal(true);
      else setActiveShift(shift);
    });
  }, [reqContext]);

  const auditEnabled = hasFeature(tenant, 'AUDIT');

  const navItemClick = (view: any) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#f3f5f6] dark:bg-[#1a2026] font-sans text-slate-900 dark:text-[#E2E8F0] overflow-hidden transition-colors relative">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-[#f3f5f6] dark:bg-[#1a2026] border-r border-[#d9d9d9] dark:border-[#3a414a] flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-[#d9d9d9] dark:border-[#3a414a] bg-[#0070b2] text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center font-bold text-white shrink-0">
              <StoreIcon size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight uppercase">EL TRIUNFO</h1>
              <p className="text-[10px] text-white/70 font-medium tracking-wide uppercase">Core ERP v2.0</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 lg:hidden text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 bg-white dark:bg-[#232a31] border-b border-[#d9d9d9] dark:border-[#3a414a] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-inner">
              {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-[#0070b2]"/> : <UserCog size={20} className="text-[#0070b2]"/>}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-black/20 p-2 border border-slate-200 dark:border-white/5 rounded">
            <StoreIcon size={14} className="text-[#0070b2] shrink-0" />
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

        <div className="p-4 border-t border-[#d9d9d9] dark:border-[#3a414a] flex flex-col gap-2">
          <button onClick={logout} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-all font-semibold border border-transparent active:scale-95">
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="flex justify-center">
             <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 transition-colors bg-[#f3f5f6] dark:bg-[#1a2026]">
        <SyncManager />
        
        <div className="lg:hidden flex items-center justify-between p-4 bg-[#0070b2] text-white border-b border-[#005a8f]">
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
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f5f6] dark:bg-[#1a2026] text-slate-900 dark:text-[#E2E8F0] font-sans flex items-center justify-center p-4 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-[#232a31] p-10 rounded shadow-2xl w-full max-w-md border border-[#d9d9d9] dark:border-[#3a414a] transition-colors">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-[#0070b2] text-white p-4 rounded mb-5 shadow-lg shrink-0 border border-white/10">
            <StoreIcon size={36} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-[#0070b2] dark:text-blue-400 uppercase">EL TRIUNFO ERP</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-3 text-xs uppercase tracking-widest font-bold">
            Portal de Acceso Centralizado
            <br/><br/> <span className="font-mono text-[10px] text-slate-400">Ambiente de Producción: admin / 1234</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Identificador de Usuario</label>
             <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] text-slate-900 dark:text-[#E2E8F0] rounded outline-none focus:ring-2 focus:ring-[#0070b2]/50 transition-all font-medium" placeholder="ID de Usuario" autoFocus />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Clave PIN de Acceso</label>
             <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className="w-full text-center tracking-[1em] text-2xl p-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] text-slate-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-[#0070b2]/50 transition-all font-medium" maxLength={4} />
          </div>
          {error && <p className="text-[#ba1c1c] text-[11px] font-bold text-center uppercase tracking-tight">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#0070b2] hover:bg-[#005a8f] text-white font-bold py-3.5 rounded transition-all shadow-md active:scale-[0.98] uppercase tracking-widest text-sm">{loading ? 'Validando...' : 'Iniciar Sesión'}</button>
        </form>
        <div className="mt-8 text-center">
           <p className="text-[10px] text-slate-400 font-medium">SAP Fiori Inspired • Intelligence for Business</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PUNTO DE VENTA
// ============================================================================

function POSView() {
  const { reqContext, tenant } = useAuth();
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmSaleInfo, setConfirmSaleInfo] = useState<any>(null);
  const [alertInfo, setAlertInfo] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // CRM State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    BackendAPI.getStoreProducts(reqContext).then(setProducts);
    BackendAPI.getClients(reqContext).then(setClients);
  }, [reqContext]);

  const filteredClients = useMemo(() => clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
  ), [clients, clientSearch]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredProducts = useMemo(() => products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery)
  ), [products, searchQuery]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (product: ProductView) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } : item);
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price }];
    });
    setSearchQuery('');
  };

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
        const offlineId = `OFF-${Date.now().toString().slice(-6)}`;
        const offlineSale = {
          saleId: offlineId,
          reqContext,
          saleData: {
            items: cart,
            paymentMethod: confirmSaleInfo.paymentMethod,
            amountTendered: confirmSaleInfo.amountTendered,
            clientId: selectedClientId,
            isOfflineSync: true,
            offlineDate: new Date().toISOString()
          }
        };

        const existingStr = localStorage.getItem('offline_sales') || '[]';
        const existing = JSON.parse(existingStr);
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
           items: cart as any[]
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
          items: cart as any[],
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
    } catch (error: any) {
      setAlertInfo({ title: 'Error en la Venta', message: error.message });
      setConfirmSaleInfo(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = (paymentMethod: PaymentMethod, amountTendered: number) => {
    setConfirmSaleInfo({ paymentMethod, amountTendered });
  };

  return (
    <div className="flex h-full bg-[#f3f5f6] dark:bg-[#1a2026] relative overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] p-8 rounded shadow-2xl flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-[#0070b2] border-t-transparent rounded-full animate-spin"></div>
             <span className="text-[#0070b2] font-bold uppercase tracking-widest text-xs">Sincronizando con ERP...</span>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col p-4 lg:p-6 h-full overflow-hidden bg-[#f3f5f6] dark:bg-[#1a2026] transition-colors relative">
        {confirmSaleInfo && <ConfirmDialog title="Confirmar Movimiento" message={`¿Estás seguro de completar esta transacción por ${formatCurrency(cartTotal)}?`} onConfirm={executeCheckout} onCancel={() => setConfirmSaleInfo(null)} />}
        {alertInfo && !alertInfo.saleData && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
        {alertInfo?.saleData && <ReceiptModal sale={alertInfo.saleData} onClose={() => setAlertInfo(null)} storeName={reqContext.storeId} />}
        
        <div className="bg-white dark:bg-[#232a31] p-3 rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] mb-5 flex items-center gap-4 transition-colors">
          <Barcode size={24} className="text-slate-500 hidden sm:block" />
          <Search size={24} className="text-slate-500 sm:hidden" />
          <input
            type="text" placeholder="Buscar producto o código..." className="flex-1 text-base lg:text-lg outline-none bg-transparent text-slate-900 dark:text-white"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4 pb-32">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock <= 0}
                className={`text-left p-0 rounded border transition-all flex flex-col overflow-hidden bg-white dark:bg-[#232a31] border-[#d9d9d9] dark:border-[#3a414a] hover:border-[#0070b2] dark:hover:border-blue-500 shadow-sm hover:shadow-md group`}>
                
                <div className="w-full h-32 sm:h-40 bg-white dark:bg-[#1a2026] overflow-hidden border-b border-[#f0f0f0] dark:border-white/5">
                  <img src={`https://picsum.photos/seed/${product.id}/400/400`} alt={product.name} className="w-full h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all" referrerPolicy="no-referrer" />
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1 w-full">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider truncate mr-1">{product.category}</span>
                    {product.stock <= product.minStock && product.stock > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm border border-amber-200 dark:border-amber-700/30 shrink-0">Bajo Stock</span>}
                    {product.stock <= 0 && <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-sm border border-red-200 dark:border-red-700/30 shrink-0">Agotado</span>}
                  </div>
                  <h3 className="font-semibold text-xs text-slate-800 dark:text-white line-clamp-2 h-8 leading-snug mb-2">{product.name}</h3>
                  <div className="mt-auto flex justify-between items-baseline pt-2 border-t border-slate-50 dark:border-white/5">
                    <span className="text-[#0070b2] dark:text-blue-400 font-bold text-base">{formatCurrency(product.price)}</span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase">Stock: {product.stock}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="lg:hidden absolute bottom-6 inset-x-4">
            <button onClick={() => setIsCartOpen(true)} className="w-full bg-[#0070b2] text-white font-bold p-4 rounded shadow-2xl flex items-center justify-between uppercase tracking-widest text-xs">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span>Carrito ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
              </div>
              <span className="text-base">{formatCurrency(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      <div className={`fixed inset-y-0 right-0 z-40 w-full sm:w-96 lg:static bg-white dark:bg-[#232a31] border-l border-[#d9d9d9] dark:border-[#3a414a] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 bg-slate-50 dark:bg-black/10 border-b border-[#d9d9d9] dark:border-[#3a414a] flex items-center justify-between">
          <h2 className="font-bold text-xs uppercase tracking-widest text-slate-500">Resumen de Materiales</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-[#f9f9f9] dark:bg-black/5">
          {cart.map(item => (
            <div key={item.id} className="flex gap-3 bg-white dark:bg-[#2c343d] p-3 border border-[#e5e5e5] dark:border-[#3a414a] rounded-sm text-slate-900 dark:text-white items-center shadow-sm">
              <div className="flex flex-col items-center bg-slate-50 dark:bg-black/20 rounded border border-slate-200 dark:border-white/5">
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:text-[#0070b2] dark:hover:text-blue-400 transition-colors"><Plus size={12} /></button>
                <span className="font-bold text-xs p-1 min-w-[24px] text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <h4 className="font-bold text-xs truncate">{item.name}</h4>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-mono">{formatCurrency(item.price)} C/U</span>
              </div>
              <div className="font-bold text-xs text-[#0070b2] dark:text-blue-400 whitespace-nowrap">{formatCurrency(item.subtotal)}</div>
            </div>
          ))}
          {!cart.length && <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 p-10 uppercase font-bold tracking-widest text-xs"><ShoppingCart size={32} /> Carrito Vacío</div>}
        </div>

        {/* CRM Selector */}
        <div className="p-4 bg-white dark:bg-[#232a31] border-t border-[#d9d9d9] dark:border-[#3a414a] space-y-3">
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
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-[#0070b2]"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
                {clientSearch && filteredClients.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-2xl z-50 max-h-48 overflow-y-auto">
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
              <div className="flex items-center gap-3 bg-[#0070b2]/5 dark:bg-[#0070b2]/10 p-2.5 rounded border border-[#0070b2]/20">
                 <div className="w-8 h-8 rounded-full bg-[#0070b2] text-white flex items-center justify-center font-bold text-xs">
                    {selectedClient.name[0]}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[#0070b2] truncate">{selectedClient.name}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase">★ Fidelidad: {selectedClient.points} pts</p>
                 </div>
              </div>
           )}
        </div>

        <div className="p-5 bg-white dark:bg-[#232a31] border-t border-[#d9d9d9] dark:border-[#3a414a] shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between items-baseline mb-4 text-slate-800 dark:text-white">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-50">VALOR TOTAL NETO</span>
            <span className="text-3xl font-black tracking-tighter text-[#0070b2] dark:text-blue-400">{formatCurrency(cartTotal)}</span>
          </div>
          <button onClick={() => setShowPaymentModal(true)} disabled={!cart.length}
            className="w-full bg-[#0070b2] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white hover:bg-[#005a8f] font-bold py-4 rounded shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs transition-all active:scale-[0.98]">
            Finalizar Selección <Plus size={18} />
          </button>
        </div>
      </div>

      {showPaymentModal && <PaymentModal total={cartTotal} onClose={() => setShowPaymentModal(false)} onComplete={handleCheckout} />}
    </div>
  );
}

function PaymentModal({ total, onClose, onComplete }: any) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState(total.toString());
  const tenderNum = parseFloat(tendered) || 0;
  const change = tenderNum - total;
  const isInvalid = method === 'CASH' && tenderNum < total;

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl overflow-hidden w-full max-w-md transition-colors">
        <div className="bg-slate-50 dark:bg-[#16191E] p-6 text-slate-900 border-b border-slate-200 dark:border-[#2D3139] text-center transition-colors"><div className="text-5xl font-mono tracking-tight text-blue-600 dark:text-blue-500">{formatCurrency(total)}</div></div>
        <div className="p-6 space-y-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setMethod('CASH'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CASH'?'border-blue-500 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400':'border-slate-200 dark:border-[#2D3139] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>EFECTIVO</button>
            <button onClick={() => { setMethod('CARD'); setTendered(total.toString()); }} className={`p-4 border rounded-xl font-bold transition-colors ${method==='CARD'?'border-blue-500 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400':'border-slate-200 dark:border-[#2D3139] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>TARJETA</button>
          </div>
          {method === 'CASH' && (
            <div>
              <input type="number" value={tendered} onChange={e => setTendered(e.target.value)} className="w-full text-right text-3xl font-mono p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] rounded-xl focus:border-blue-500 outline-none text-slate-900 dark:text-white transition-colors" onFocus={(e: any) => e.target.select()}/>
              <div className="flex justify-between mt-4"><span>Cambio</span><span className="font-mono text-2xl text-slate-900 dark:text-white">{formatCurrency(change>0?change:0)}</span></div>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
            <button onClick={() => onComplete(method, tenderNum)} disabled={isInvalid} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:bg-slate-200 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 transition-colors">Confirmar</button>
          </div>
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
  const [isEditing, setIsEditing] = useState<any>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductView | null>(null);
  const [alertInfo, setAlertInfo] = useState<any>(null);

  const loadData = () => BackendAPI.getStoreProducts(reqContext).then(setProducts);
  useEffect(() => { loadData(); }, []);

  const handleSave = async (data: any) => {
    try {
      await BackendAPI.saveProduct(reqContext, data);
      await loadData();
      setIsEditing(null);
      setAlertInfo({ title: 'Éxito', message: 'El producto se guardó correctamente.' });
    } catch (e:any) { 
      setAlertInfo({ title: 'Error', message: e.message });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await BackendAPI.deleteProduct(reqContext, confirmDelete.id);
      await loadData();
      setConfirmDelete(null);
      setAlertInfo({ title: 'Producto Eliminado', message: 'El producto fue eliminado permanentemente.' });
    } catch (e:any) {
      setAlertInfo({ title: 'Error', message: e.message });
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkImport(false);
    setAlertInfo({ title: 'Inventario Importado', message: 'Los productos se importaron exitosamente.' });
    loadData();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col bg-[#f3f5f6] dark:bg-[#1a2026] relative text-slate-900 dark:text-[#E2E8F0] transition-colors">
      {confirmDelete && <ConfirmDialog title="Eliminar Objeto Maestro" message={`¿Confirmas la eliminación permanente del registro "${confirmDelete.name}"?`} onConfirm={executeDelete} onCancel={() => setConfirmDelete(null)} />}
      {alertInfo && <AlertDialog title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo(null)} />}
      {isEditing && <ProductFormModal product={isEditing} onClose={() => setIsEditing(null)} onSave={handleSave} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={handleBulkSuccess} />}
      
      <div className="flex flex-col md:flex-row md:justify-between tracking-tight gap-4 mb-6 lg:mb-8">
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Maestro de Materiales ERP</h2></div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkImport(true)} className="flex-1 md:flex-none justify-center bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] hover:bg-slate-50 text-slate-900 dark:text-white text-xs px-4 py-2.5 rounded font-bold flex items-center gap-2 transition-colors uppercase tracking-widest"><Upload size={18}/> Importar</button>
          <button onClick={() => setIsEditing({category: 'Abarrotes', stock: 0, minStock: 5})} className="flex-1 md:flex-none justify-center bg-[#0070b2] hover:bg-[#005a8f] text-white text-xs px-4 py-2.5 rounded font-bold flex items-center gap-2 transition-colors uppercase tracking-widest shadow-md"><Plus size={18}/> Crear Material</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#232a31] flex-1 rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] overflow-hidden flex flex-col transition-colors">
        <div className="p-3 lg:p-4 border-b border-[#d9d9d9] dark:border-[#3a414a] transition-colors bg-slate-50 dark:bg-black/10">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Filtrar por descripción, categoría o ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1a2026] border border-[#d9d9d9] dark:border-[#3a414a] text-xs font-semibold text-slate-900 dark:text-white rounded outline-none focus:ring-1 focus:ring-[#0070b2] transition-colors"/>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] text-slate-500 uppercase font-black tracking-[0.1em] sticky top-0 transition-colors z-10">
              <tr><th className="px-6 py-4">ID MATERIAL</th><th className="px-6 py-4">DESCRIPCIÓN</th><th className="px-6 py-4">PVP UNITARIO</th><th className="px-6 py-4 text-center">UBICACIÓN/STOCK</th><th className="px-6 py-4 text-center">ACCIONES</th></tr>
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
                  <td className="px-6 py-4 text-center">
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ product, onClose, onSave }: any) {
  const [data, setData] = useState(product);
  const [loading, setLoading] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true);
    await onSave({ ...data, cost: Number(data.cost), price: Number(data.price), stock: Number(data.stock), minStock: Number(data.minStock) });
    setLoading(false);
  }
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl w-full max-w-xl p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">{product.id ? 'Editar' : 'Nuevo'} Producto</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <input required placeholder="Código (ej. 12345)" value={data.barcode||''} onChange={e=>setData({...data, barcode: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Categoría (ej. General)" value={data.category||''} onChange={e=>setData({...data, category: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required placeholder="Nombre ('producto')" value={data.name||''} onChange={e=>setData({...data, name: e.target.value})} className="col-span-2 p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Costo proveedor" value={data.cost||''} onChange={e=>setData({...data, cost: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" step="0.01" placeholder="Venta publico" value={data.price||''} onChange={e=>setData({...data, price: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Items (Stock)" value={data.stock||0} onChange={e=>setData({...data, stock: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
          <input required type="number" placeholder="Min Stock" value={data.minStock||0} onChange={e=>setData({...data, minStock: e.target.value})} className="p-3 bg-slate-50 dark:bg-[#0F1115] border border-slate-200 dark:border-[#2D3139] text-slate-900 dark:text-white rounded-xl focus:border-blue-500 outline-none transition-colors" />
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-white/5 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl font-bold transition-colors">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { reqContext } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<any[] | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (!data || data.length === 0) throw new Error("El archivo está vacío o no se pudo leer correctamente.");

        const formattedProducts = data.map((row: any, index: number) => {
          const name = row['producto'] || row['Producto'] || row['Name'] || '';
          const cost = Number(row['Costo proveedor'] || row['Costo'] || row['cost'] || 0);
          const price = Number(row['Venta publico'] || row['Precio'] || row['price'] || 0);
          const stock = Number(row['Items'] || row['Stock'] || row['stock'] || 0);

          if (!name) throw new Error(`Fila ${index + 1}: El nombre del producto es obligatorio.`);

          return {
            name,
            cost,
            price,
            stock,
            minStock: 5,
            category: 'General',
            barcode: Math.floor(100000000 + Math.random() * 900000000).toString(),
          };
        });

        setConfirmData(formattedProducts);
      } catch (err: any) {
        setError(err.message || "Error al procesar el archivo Excel.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    if (!confirmData) return;
    try {
      setLoading(true);
      await BackendAPI.saveProductsBulk(reqContext, confirmData);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al procesar el archivo Excel.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {confirmData && (
        <ConfirmDialog 
          title="Confirmar Importación" 
          message={`¿Estás seguro de importar ${confirmData.length} productos a este catálogo?`} 
          onConfirm={processImport} 
          onCancel={() => setConfirmData(null)} 
        />
      )}
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] rounded-2xl w-full max-w-md p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Importar Inventario</h2>
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
          <button type="button" onClick={onClose} disabled={loading} className="w-full py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cerrar</button>
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

  useEffect(() => {
    BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales);
    BackendAPI.getStoreProducts(reqContext).then(setProducts);
  }, [reqContext]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((sum, sale) => sum + (sale.items?.reduce((c, i) => c + (i.cost * i.quantity), 0) || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const iv = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

  // Data processing for Charts
  const salesByDate = useMemo(() => {
    const groups: any = {};
    sales.forEach(s => {
      const date = new Date(s.datetime).toLocaleDateString();
      groups[date] = (groups[date] || 0) + s.total;
    });
    return Object.entries(groups).map(([date, total]) => ({ date, total })).reverse();
  }, [sales]);

  const categoryMix = useMemo(() => {
    const cats: any = {};
    products.forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + (p.stock * p.price);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [products]);

  const COLORS = ['#0070b2', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-[#f3f5f6] dark:bg-[#1a2026] text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      <div className="flex justify-between items-center bg-white dark:bg-[#232a31] p-4 rounded border border-[#d9d9d9] dark:border-[#3a414a] shadow-sm">
        <h2 className="text-lg font-bold tracking-tight text-[#0070b2] uppercase">Panel de Inteligencia de Negocio</h2>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <TrendingUp size={12} /> Live Sync Active
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Ingresos Brutos" value={formatCurrency(totalRevenue)} icon={<Banknote size={24}/>} />
        <StatCard title="Margen de Utilidad" value={formatCurrency(totalProfit)} icon={<TrendingUp size={24}/>} />
        <StatCard title="Valuación Maestro" value={formatCurrency(iv)} icon={<PackageSearch size={24}/>} />
        <StatCard title="Transacciones" value={sales.length} icon={<Receipt size={24}/>} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="xl:col-span-2 bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm p-6">
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
                <Line type="monotone" dataKey="total" stroke="#0070b2" strokeWidth={3} dot={{ fill: '#0070b2', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Mix */}
        <div className="bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#d9d9d9] dark:border-[#3a414a] font-bold text-xs uppercase bg-slate-50 dark:bg-black/10">Salud Operativa del Sistema</div>
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
         
         <div className="bg-gradient-to-br from-[#0070b2] to-[#005a8f] rounded p-6 text-white shadow-lg flex flex-col justify-between">
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

function SalesView() {
  const { reqContext } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  useEffect(() => { BackendAPI.getSales({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setSales); }, [reqContext]);

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col bg-[#f3f5f6] dark:bg-[#1a2026] text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      {selectedReceipt && <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} storeName={reqContext.storeId} />}
      <div className="flex justify-between items-center">
         <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">Histórico de Transacciones SAP</h2>
         <div className="bg-[#0070b2]/10 text-[#0070b2] text-[10px] font-bold px-3 py-1 rounded ring-1 ring-[#0070b2]/20 uppercase">Registros: {sales.length}</div>
      </div>
      <div className="bg-white dark:bg-[#232a31] flex-1 rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] overflow-auto transition-colors">
        <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
          <thead className="bg-[#f0f3f4] dark:bg-[#2c343d] border-b border-[#d9d9d9] dark:border-[#3a414a] uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
            <tr><th className="px-6 py-4">UUID TRANSACCIÓN</th><th className="px-6 py-4">MARCA DE TIEMPO</th><th className="px-6 py-4">MÉTODO PAGO</th><th className="px-6 py-4 text-right">VALOR NETO</th><th className="px-6 py-4 text-center">UM</th><th className="px-6 py-4 text-center">ACCIONES</th></tr>
          </thead>
          <tbody className="divide-y divide-[#d9d9d9] dark:divide-[#3a414a] transition-colors">
            {sales.map(s => (
              <tr key={s.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-slate-700 dark:text-slate-300">
                <td className="px-6 py-4 font-mono text-slate-500 text-[10px]">{s.id}</td>
                <td className="px-6 py-4 font-semibold">{new Date(s.datetime).toLocaleString()}</td>
                <td className="px-6 py-4 font-bold text-[#0070b2] dark:text-blue-400 uppercase tracking-tighter">{s.paymentMethod}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(s.total)}</td>
                <td className="px-6 py-4 text-center font-bold text-slate-500">{s.itemsCount} LIN</td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setSelectedReceipt(s)} className="p-2 text-[#0070b2] hover:bg-white dark:hover:bg-black/20 rounded-full transition-colors"><Printer size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsView() {
  const { reqContext } = useAuth();
  const [moves, setMoves] = useState<any[]>([]);
  useEffect(() => { BackendAPI.getStockMovements({ tenantId: reqContext.tenantId, storeId: reqContext.storeId }).then(setMoves); }, [reqContext]);
  
  return (
    <div className="p-4 lg:p-8 h-full flex flex-col bg-[#f3f5f6] dark:bg-[#1a2026] text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">Libro de Logística y Auditoría</h2>
      <div className="bg-white dark:bg-[#232a31] flex-1 rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] p-6 flex flex-col gap-4 overflow-y-auto transition-colors">
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

function ReceiptModal({ sale, storeName, onClose }: any) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 print:p-0 print:bg-white transition-opacity">
      <div className="flex gap-4 mb-6 no-print flex-col sm:flex-row w-full sm:w-auto">
        <button onClick={handlePrint} className="bg-[#0070b2] hover:bg-[#005a8f] text-white font-bold py-3 px-8 rounded flex items-center justify-center gap-2 shadow-xl transition-all uppercase tracking-widest text-xs border border-white/10"><Printer size={18}/> Imprimir</button>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded flex items-center justify-center gap-2 transition-colors border border-white/10 uppercase tracking-widest text-xs">Cerrar</button>
      </div>
      
      <div className="relative bg-[#faf9f6] text-slate-900 w-full max-w-[340px] flex-col overflow-visible shadow-2xl print:shadow-none print:w-full drop-shadow-2xl">
         <div className="p-8 pb-12 flex flex-col items-center relative z-10 bg-[#faf9f6]">
             <div className="w-14 h-14 bg-[#0070b2] text-white rounded-full flex items-center justify-center mb-4 shadow"><StoreIcon size={28}/></div>
             <h2 className="font-extrabold text-2xl tracking-tighter uppercase mb-1 text-[#0070b2] text-center leading-none">EL TRIUNFO ERP</h2>
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
                    {sale.items?.map((item: any, i: number) => (
                      <tr key={i} className="align-top">
                        <td className="py-2 pr-2">{item.quantity}</td>
                        <td className="py-2 pr-2 uppercase">{item.name}</td>
                        <td className="py-2 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>

             <div className="w-full flex flex-col gap-1 text-sm font-mono border-t border-slate-800 pt-3">
                <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-300">
                  <span className="font-bold text-slate-800 tracking-widest uppercase">TOTAL</span>
                  <span className="font-black text-3xl tracking-tighter text-emerald-600">{formatCurrency(sale.total)}</span>
                </div>
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
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] p-6 rounded-2xl w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] shadow-xl transition-colors">
        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-bold transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function AlertDialog({ title, message, onClose }: { title: string, message: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-[#0F1115]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] p-6 rounded-2xl w-full max-w-sm text-slate-900 dark:text-[#E2E8F0] shadow-xl text-center transition-colors">
        <div className="flex justify-center mb-4 text-emerald-500"><CheckCircle2 size={48} /></div>
        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-500 mb-6">{message}</p>
        <button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors">Aceptar</button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-semibold text-sm transition-all ${active ? 'bg-[#0070b2]/10 text-[#0070b2] dark:text-blue-400 border border-[#0070b2]/20 shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 border border-transparent'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ icon, title, value }: any) {
  return (
    <div className="bg-white dark:bg-[#232a31] p-6 border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm flex flex-col justify-between transition-colors">
      <div className={`text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center justify-between`}>
        {title}
        <div className={`p-1.5 rounded-sm bg-slate-50 dark:bg-black/20 text-[#0070b2] dark:text-blue-400`}>{icon}</div>
      </div>
      <h4 className="text-3xl font-mono text-slate-800 dark:text-white tracking-tighter">{value}</h4>
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppTheme();
  return (
    <button onClick={theme.toggleTheme} className="px-4 py-3 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors">
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

  const loadData = async () => {
    const [active, history] = await Promise.all([
      BackendAPI.getActiveShift(reqContext),
      BackendAPI.getShifts(reqContext)
    ]);
    setActiveShift(active);
    setShifts(history);
  };

  useEffect(() => { loadData(); }, [reqContext]);

  const handleClose = async () => {
    if (!activeShift) return;
    setLoading(true);
    try {
      await BackendAPI.closeShift(reqContext, parseFloat(countedCash) || 0);
      onShiftClosed();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-[#f3f5f6] dark:bg-[#1a2026] text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">Control de Efectivo y Turnos</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Shift Card */}
        <div className="xl:col-span-2 bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm p-6">
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
                      className="w-full md:w-64 pl-8 pr-4 py-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold text-lg outline-none focus:ring-2 focus:ring-[#0070b2]/50"
                      value={countedCash}
                      onChange={e => setCountedCash(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleClose}
                    disabled={loading || !countedCash}
                    className="w-full bg-[#ba1c1c] hover:bg-red-700 text-white font-bold py-3 rounded shadow-md uppercase tracking-widest text-xs transition-all disabled:opacity-50"
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
          <div className="bg-white dark:bg-[#232a31] border border-[#d9d9d9] dark:border-[#3a414a] rounded shadow-sm p-6">
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
      <div className="bg-white dark:bg-[#232a31] rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#d9d9d9] dark:border-[#3a414a] font-bold text-xs uppercase bg-slate-50 dark:bg-black/10">Historial de Cortes de Caja</div>
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

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const shift = await BackendAPI.openShift(reqContext, parseFloat(initialCash) || 0);
      onOpen(shift);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0070b2]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-[#2D3139] p-8 rounded-2xl w-full max-w-md shadow-2xl transition-colors">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#0070b2]/10 text-[#0070b2] rounded-full flex items-center justify-center mb-4">
            <ArrowDownCircle size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Apertura de Turno SAP</h2>
          <p className="text-sm text-slate-500 mt-2">No hay un turno activo para tu usuario. Ingresa el fondo de caja inicial para comenzar a operar.</p>
        </div>
        
        <div className="space-y-4 mb-8">
           <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Fondo de Caja (MXN)</label>
           <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-300">$</span>
              <input 
                required 
                type="number" 
                className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded-xl text-3xl font-mono font-bold text-[#0070b2] outline-none focus:ring-2 focus:ring-[#0070b2]/50"
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
          className="w-full bg-[#0070b2] hover:bg-[#005a8f] text-white font-bold py-4 rounded-xl shadow-lg uppercase tracking-widest text-sm transition-all active:scale-[0.98]"
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

  const loadClients = async () => {
    const data = await BackendAPI.getClients(reqContext);
    setClients(data);
  };

  useEffect(() => { loadClients(); }, [reqContext]);

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.taxId?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const handleSave = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await BackendAPI.saveClient(reqContext, editingClient!);
      setEditingClient(null);
      loadClients();
    } catch (e: any) {
      alert(e.message);
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
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-[#f3f5f6] dark:bg-[#1a2026] flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Users className="text-[#0070b2]" /> Directorio de Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">Gestión de cartera y lealtad</p>
        </div>
        <button 
          onClick={() => setEditingClient({ name: '', email: '', phone: '', taxId: '' })}
          className="bg-[#0070b2] hover:bg-[#005a8f] text-white px-6 py-3 rounded shadow-md font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-[#232a31] p-4 rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a]">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, RFC o teléfono..." 
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-black/10 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold text-sm outline-none focus:ring-2 focus:ring-[#0070b2]/50 transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#232a31] rounded shadow-sm border border-[#d9d9d9] dark:border-[#3a414a] overflow-hidden">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2026] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-[#3a414a]">
            <div className="p-6 border-b border-slate-100 dark:border-[#3a414a] flex justify-between items-center bg-slate-50 dark:bg-black/20">
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#0070b2]">
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
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold outline-none focus:ring-2 focus:ring-[#0070b2]/50"
                     value={editingClient.name}
                     onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                   />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">RFC / TAX ID</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold outline-none focus:ring-2 focus:ring-[#0070b2]/50"
                    value={editingClient.taxId}
                    onChange={e => setEditingClient({...editingClient, taxId: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Teléfono</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold outline-none focus:ring-2 focus:ring-[#0070b2]/50"
                    value={editingClient.phone}
                    onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Email</label>
                <input 
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-[#d9d9d9] dark:border-[#3a414a] rounded font-bold outline-none focus:ring-2 focus:ring-[#0070b2]/50"
                  value={editingClient.email}
                  onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#0070b2] hover:bg-[#005a8f] text-white font-bold py-4 rounded shadow-lg uppercase tracking-widest text-xs transition-all"
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
