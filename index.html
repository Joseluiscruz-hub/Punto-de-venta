import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  ShoppingCart, LayoutDashboard, PackageSearch, Receipt, LogOut, 
  Plus, Search, Trash2, Edit, Barcode, CreditCard, Banknote,
  TrendingUp, AlertCircle, CheckCircle2, Lock, UserCog, ShieldCheck,
  History, Save, X
} from 'lucide-react';

// ============================================================================
// 1. CAPA DE DOMINIO (Modelos y Tipos)
// ============================================================================

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type PaymentMethod = 'CASH' | 'CARD';
export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}

export interface SaleItem extends Product {
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  datetime: string;
  cashierId: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  change: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  userId: string;
  type: MovementType;
  quantity: number;
  date: string;
  reason?: string;
}

// ============================================================================
// 2. CAPA DE INFRAESTRUCTURA (Simulación de Backend / API REST)
// En un entorno real, estos métodos harían fetch() a Node.js/Postgres
// ============================================================================

// Base de datos en memoria (Simulación)
let DB = {
  users: [
    { id: 'u1', username: 'admin', name: 'Administrador', role: 'ADMIN' as Role },
    { id: 'u2', username: 'caja1', name: 'Juan Pérez (Caja 1)', role: 'CASHIER' as Role }
  ],
  products: [
    { id: 'p1', barcode: '75010001', name: 'Leche Entera Alpura 1L', category: 'Lácteos', cost: 18.5, price: 25.0, stock: 45, minStock: 10 },
    { id: 'p2', barcode: '75010002', name: 'Pan Bimbo Blanco', category: 'Panadería', cost: 30.0, price: 42.0, stock: 12, minStock: 15 },
    { id: 'p3', barcode: '75010003', name: 'Coca-Cola 600ml', category: 'Bebidas', cost: 11.0, price: 18.0, stock: 120, minStock: 24 },
  ],
  sales: [] as Sale[],
  movements: [] as StockMovement[]
};

// Simulador de latencia de red
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const BackendAPI = {
  async login(username: string, pin: string): Promise<User> {
    await delay(500); // Simulando red
    const user = DB.users.find(u => u.username === username);
    // Para simplificar el demo, el PIN es "1234" para admin y "0000" para caja1
    if (user && ((username === 'admin' && pin === '1234') || (username === 'caja1' && pin === '0000'))) {
      return user;
    }
    throw new Error('Credenciales inválidas');
  },

  async getProducts(): Promise<Product[]> {
    await delay(300);
    return [...DB.products];
  },

  async getSales(): Promise<Sale[]> {
    await delay(300);
    return [...DB.sales].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  },

  async saveProduct(product: Omit<Product, 'id'> | Product, userId: string): Promise<Product> {
    await delay(400);
    const isNew = !('id' in product) || !product.id;
    let savedProduct: Product;

    if (isNew) {
      savedProduct = { ...product, id: `p${Date.now()}` } as Product;
      DB.products.push(savedProduct);
      
      // Registrar movimiento de stock inicial si hay stock
      if (savedProduct.stock > 0) {
        DB.movements.push({
          id: `m${Date.now()}`, productId: savedProduct.id, userId, type: 'PURCHASE',
          quantity: savedProduct.stock, date: new Date().toISOString(), reason: 'Inventario Inicial'
        });
      }
    } else {
      const index = DB.products.findIndex(p => p.id === product.id);
      if (index === -1) throw new Error('Producto no encontrado');
      
      const oldProduct = DB.products[index];
      savedProduct = product as Product;
      DB.products[index] = savedProduct;

      // Si el stock cambió manualmente (Ajuste)
      if (oldProduct.stock !== savedProduct.stock) {
        const diff = savedProduct.stock - oldProduct.stock;
        DB.movements.push({
          id: `m${Date.now()}`, productId: savedProduct.id, userId, type: 'ADJUSTMENT',
          quantity: diff, date: new Date().toISOString(), reason: 'Ajuste manual'
        });
      }
    }
    return savedProduct;
  },

  // Transacción atómica simulada: Crea venta, descuenta stock, crea movimientos
  async processSale(saleData: Omit<Sale, 'id' | 'datetime'>): Promise<Sale> {
    await delay(600);
    
    // 1. Validaciones
    for (const item of saleData.items) {
      const dbProduct = DB.products.find(p => p.id === item.id);
      if (!dbProduct) throw new Error(`Producto ${item.name} no existe`);
      if (dbProduct.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
    }

    // 2. Crear Venta
    const newSale: Sale = {
      ...saleData,
      id: `TRX-${Date.now().toString().slice(-6)}`,
      datetime: new Date().toISOString(),
    };
    DB.sales.push(newSale);

    // 3. Actualizar Stock y Registrar Movimientos
    saleData.items.forEach(item => {
      const prodIndex = DB.products.findIndex(p => p.id === item.id);
      DB.products[prodIndex].stock -= item.quantity;

      DB.movements.push({
        id: `m${Date.now()}-${item.id}`,
        productId: item.id,
        userId: saleData.cashierId,
        type: 'SALE',
        quantity: -item.quantity,
        date: newSale.datetime,
        reason: `Venta ${newSale.id}`
      });
    });

    return newSale;
  }
};

// ============================================================================
// 3. ESTADO GLOBAL Y HOOKS (Contextos)
// ============================================================================

interface AuthContextType {
  user: User | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ============================================================================
// 4. COMPONENTES DE VISTA PRINCIPAL (App)
// ============================================================================

export default function AbarrotesApp() {
  const [user, setUser] = useState<User | null>(null);
  
  const login = async (username: string, pin: string) => {
    const u = await BackendAPI.login(username, pin);
    setUser(u);
  };
  
  const logout = () => setUser(null);
  
  const hasPermission = (roles: Role[]) => {
    return user ? roles.includes(user.role) : false;
  };

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
        <LoginScreen />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      <MainLayout />
    </AuthContext.Provider>
  );
}

// ============================================================================
// 5. LAYOUT Y NAVEGACIÓN
// ============================================================================

function MainLayout() {
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
            {user?.role === 'ADMIN' ? <ShieldCheck size={20} className="text-emerald-400"/> : <UserCog size={20} />}
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

// ============================================================================
// 6. PANTALLA DE ACCESO (LOGIN)
// ============================================================================

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, pin);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-900 text-white p-4 rounded-2xl mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800">Acceso al Sistema</h1>
          <p className="text-slate-500 text-center mt-2 text-sm">
            Ingresa tus credenciales operativas. <br/>
            <span className="text-xs bg-slate-100 p-1.5 rounded mt-2 inline-block text-slate-600 font-mono">
              Admin: admin / 1234 <br/> Caja: caja1 / 0000
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              placeholder="Ej. admin"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PIN de Seguridad</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[1em] p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-all font-mono"
              maxLength={4}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg font-medium">{error}</p>}
          <button 
            type="submit"
            disabled={loading || !username || !pin}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {loading ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 7. MÓDULO: PUNTO DE VENTA (UI + Lógica Desacoplada)
// ============================================================================

function POSView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cargar inventario al montar
  useEffect(() => {
    BackendAPI.getProducts().then(setProducts);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode.includes(searchQuery)
    );
  }, [products, searchQuery]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } 
          : item);
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price }];
    });
    setSearchQuery('');
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
      return;
    }
    const productInfo = products.find(p => p.id === id);
    if (!productInfo || newQuantity > productInfo.stock) return;

    setCart(prev => prev.map(item => item.id === id 
      ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price } 
      : item));
  };

  const handleCheckout = async (paymentMethod: PaymentMethod, amountTendered: number) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      // Llamada al servicio transaccional
      await BackendAPI.processSale({
        cashierId: user.id,
        items: cart,
        total: cartTotal,
        paymentMethod,
        amountTendered,
        change: amountTendered - cartTotal
      });
      
      // Limpiar POS y refrescar stock
      setCart([]);
      setShowPaymentModal(false);
      const updatedProducts = await BackendAPI.getProducts();
      setProducts(updatedProducts);
      
    } catch (error: any) {
      alert("Error procesando venta: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-100 relative">
      {isProcessing && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-4 text-emerald-600 font-bold">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            Procesando transacción segura...
          </div>
        </div>
      )}

      {/* Catálogo */}
      <div className="flex-1 flex flex-col p-6 h-full overflow-hidden">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex items-center gap-4">
          <Barcode size={24} className="text-slate-400" />
          <input
            type="text"
            placeholder="Escanear código de barras o buscar..."
            className="flex-1 text-lg outline-none bg-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all hover:shadow-md ${
                  product.stock <= 0 ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-emerald-400 active:scale-95'
                }`}
              >
                <div className="w-full flex justify-between items-start mb-3">
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">{product.category}</span>
                  {product.stock <= product.minStock && product.stock > 0 && <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">Stock: {product.stock}</span>}
                  {product.stock <= 0 && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg">Agotado</span>}
                </div>
                <h3 className="font-bold text-slate-800 flex-1">{product.name}</h3>
                <div className="w-full flex justify-between items-end mt-4">
                  <span className="text-slate-400 text-xs">{product.barcode}</span>
                  <span className="text-xl font-black text-emerald-600">{formatCurrency(product.price)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">Ticket Actual</h2>
          <p className="text-xs text-slate-500 mt-1">Cajero: {user?.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex gap-3 bg-white p-3 border border-slate-100 rounded-xl shadow-sm">
              <div className="flex flex-col items-center justify-between bg-slate-50 rounded-lg p-1 border border-slate-100">
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-white rounded"><Plus size={14} /></button>
                <span className="font-bold text-sm my-1">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={14} /></button>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <h4 className="font-bold text-sm leading-tight text-slate-800">{item.name}</h4>
                <span className="text-slate-400 text-xs mt-1">{formatCurrency(item.price)} c/u</span>
              </div>
              <div className="flex flex-col items-end justify-center font-black text-slate-800">
                {formatCurrency(item.subtotal)}
              </div>
            </div>
          ))}
          {cart.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShoppingCart size={48} className="opacity-20 mb-4" />
                <p>Carrito vacío</p>
             </div>
          )}
        </div>

        <div className="p-6 bg-slate-900 text-white rounded-t-3xl">
          <div className="flex justify-between items-center mb-4 opacity-80">
            <span>Subtotal ({cart.length} arts)</span>
            <span>{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-6 text-3xl font-black">
            <span>Total</span>
            <span className="text-emerald-400">{formatCurrency(cartTotal)}</span>
          </div>
          <button 
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:bg-slate-800 disabled:text-slate-600 transition-all"
          >
            Cobrar <CheckCircle2 size={24} />
          </button>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal total={cartTotal} onClose={() => setShowPaymentModal(false)} onComplete={handleCheckout} />
      )}
    </div>
  );
}

// ============================================================================
// 8. MODAL DE PAGO
// ============================================================================

function PaymentModal({ total, onClose, onComplete }: { total: number, onClose: ()=>void, onComplete: (m: PaymentMethod, t: number)=>void }) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState(total.toString());
  
  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - total;
  const isInvalid = method === 'CASH' && tenderedNum < total;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center border-b-4 border-emerald-500">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Procesar Cobro</h2>
          <div className="text-5xl font-black">{formatCurrency(total)}</div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setMethod('CASH'); setTendered(total.toString()); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
              <Banknote size={32} /> <span className="font-bold">Efectivo</span>
            </button>
            <button onClick={() => { setMethod('CARD'); setTendered(total.toString()); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === 'CARD' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
              <CreditCard size={32} /> <span className="font-bold">Tarjeta</span>
            </button>
          </div>

          {method === 'CASH' && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Efectivo recibido</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-bold">$</span>
                  <input type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} className="w-full text-right text-3xl font-black p-3 pl-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none" onFocus={(e) => e.target.select()}/>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Cambio a entregar</span>
                <span className={`text-3xl font-black ${change < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {formatCurrency(change >= 0 ? change : 0)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button onClick={onClose} className="flex-1 py-4 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancelar</button>
            <button onClick={() => onComplete(method, method === 'CASH' ? tenderedNum : total)} disabled={isInvalid} className={`flex-1 py-4 font-bold rounded-xl transition-all ${isInvalid ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'}`}>Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. MÓDULO: ADMINISTRACIÓN E INVENTARIO (CRUD)
// ============================================================================

function InventoryView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<Product | Partial<Product> | null>(null);

  const loadData = () => BackendAPI.getProducts().then(setProducts);
  useEffect(() => { loadData(); }, []);

  const handleSave = async (productData: any) => {
    try {
      await BackendAPI.saveProduct(productData, user!.id);
      await loadData();
      setIsEditing(null);
    } catch (e: any) {
      alert("Error guardando: " + e.message);
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50 relative">
      {/* Modal Formulario */}
      {isEditing && (
        <ProductFormModal 
          product={isEditing} 
          onClose={() => setIsEditing(null)} 
          onSave={handleSave} 
        />
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Catálogo e Inventario</h2>
          <p className="text-slate-500 mt-1">Gestión centralizada de productos y existencias.</p>
        </div>
        <button onClick={() => setIsEditing({ category: 'Abarrotes', stock: 0, minStock: 5 })} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg">
          <Plus size={20} /> Nuevo Producto
        </button>
      </div>

      <div className="bg-white flex-1 rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Buscar producto o código..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none font-medium"/>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">SKU / Código</th>
                <th className="p-4">Producto</th>
                <th className="p-4 text-right">Costo</th>
                <th className="p-4 text-right">Precio</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map(p => {
                const margin = (((p.price - p.cost) / p.cost) * 100).toFixed(0);
                const isLowStock = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 font-mono text-slate-500">{p.barcode}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <span className="text-xs text-slate-400">{p.category}</span>
                    </td>
                    <td className="p-4 text-right text-slate-500">{formatCurrency(p.cost)}</td>
                    <td className="p-4 text-right">
                      <div className="font-black text-slate-800">{formatCurrency(p.price)}</div>
                      <div className="text-[10px] text-emerald-600 font-bold uppercase">{margin}% margen</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full font-black ${isLowStock ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-slate-100 text-slate-700'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => setIsEditing(p)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Subcomponente: Formulario de Producto
function ProductFormModal({ product, onClose, onSave }: any) {
  const [formData, setFormData] = useState(product);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      ...formData,
      cost: Number(formData.cost),
      price: Number(formData.price),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock)
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-800">{product.id ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Código de Barras</label>
              <input required type="text" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
              <input required type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Producto</label>
              <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border rounded-xl font-bold text-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Costo (Compra)</label>
              <input required type="number" step="0.01" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Precio (Venta)</label>
              <input required type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-3 border rounded-xl font-bold text-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stock Actual</label>
              <input required type="number" value={formData.stock || 0} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Alerta Stock Mínimo</label>
              <input required type="number" value={formData.minStock || 0} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full p-3 border rounded-xl" />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2">
              <Save size={20} /> Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 10. MÓDULO: ANALÍTICA Y REPORTING (Dashboard)
// ============================================================================

function DashboardView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    BackendAPI.getSales().then(setSales);
    BackendAPI.getProducts().then(setProducts);
  }, []);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((totalCost, sale) => {
    return totalCost + sale.items.reduce((itemCost, item) => itemCost + (item.cost * item.quantity), 0);
  }, 0);
  const totalProfit = totalRevenue - totalCost;
  
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const inventoryValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-800">Métricas de Negocio</h2>
        <p className="text-slate-500 mt-1">Visión general del rendimiento financiero.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={<Banknote size={24} />} title="Ingresos Totales" value={formatCurrency(totalRevenue)} color="bg-blue-500" />
        <StatCard icon={<TrendingUp size={24} />} title="Ganancia Neta" value={formatCurrency(totalProfit)} color="bg-emerald-500" />
        <StatCard icon={<PackageSearch size={24} />} title="Valor en Inventario" value={formatCurrency(inventoryValue)} color="bg-purple-500" />
        <StatCard icon={<AlertCircle size={24} />} title="Alertas Stock" value={`${lowStockProducts.length} Prod.`} color={lowStockProducts.length > 0 ? "bg-red-500" : "bg-slate-400"} />
      </div>

      {/* Tablas resumen... */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">Atención Requerida (Stock)</h3>
          <div className="space-y-3">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl">
                <div><p className="font-bold text-slate-800 text-sm">{p.name}</p><p className="text-xs text-slate-500">{p.barcode}</p></div>
                <div className="text-right"><p className="font-black text-red-600 text-lg">{p.stock}</p><p className="text-[10px] text-red-400 uppercase font-bold">Mín: {p.minStock}</p></div>
              </div>
            ))}
            {lowStockProducts.length === 0 && <p className="text-sm text-slate-400">Inventario sano.</p>}
          </div>
         </div>
      </div>
    </div>
  );
}

// ============================================================================
// 11. MÓDULO: AUDITORÍA DE VENTAS
// ============================================================================

function SalesView() {
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { BackendAPI.getSales().then(setSales); }, []);

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-800">Auditoría de Transacciones</h2>
        <p className="text-slate-500 mt-1">Registro inmutable de todas las ventas procesadas.</p>
      </div>

      <div className="bg-white flex-1 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">Trx ID / Fecha</th>
                <th className="p-4">Cajero</th>
                <th className="p-4">Detalle Artículos</th>
                <th className="p-4 text-center">Método</th>
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="font-mono font-bold text-slate-700">{sale.id}</p>
                    <p className="text-xs text-slate-400">{new Date(sale.datetime).toLocaleString()}</p>
                  </td>
                  <td className="p-4 font-medium">{DB.users.find(u=>u.id===sale.cashierId)?.name || sale.cashierId}</td>
                  <td className="p-4">
                    <ul className="text-xs text-slate-500 space-y-1">
                      {sale.items.map((item, i) => <li key={i}><span className="font-bold">{item.quantity}x</span> {item.name}</li>)}
                    </ul>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${sale.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-emerald-600 text-lg">{formatCurrency(sale.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES REUTILIZABLES & UTILIDADES
// ============================================================================

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon} <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${color} shadow-lg mb-4`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-3xl font-black text-slate-800">{value}</h4>
      </div>
    </div>
  );
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
