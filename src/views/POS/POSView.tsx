import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, UserPlus, Plus, Minus, X, ShoppingCart
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import { useAuth } from '../../contexts/AuthContext';
import type { Product, SaleItem, PaymentMethod } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';

export default function POSView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadProducts();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadProducts = async () => {
    try {
      setError(null);
      const data = await BackendAPI.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos');
    }
  };

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(products.map(p => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchesCategory = category === 'Todas' || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, subtotal: newQty * item.price };
      }
      return item;
    }));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const discount = useMemo(() => subtotal * (discountRate / 100), [subtotal, discountRate]);
  const taxedSubtotal = useMemo(() => subtotal - discount, [subtotal, discount]);
  const taxes = useMemo(() => taxedSubtotal * 0.16, [taxedSubtotal]);
  const total = useMemo(() => taxedSubtotal + taxes, [taxedSubtotal, taxes]);
  const change = useMemo(() => Math.max(0, cashReceived - total), [cashReceived, total]);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      await BackendAPI.processSale({
        items: cart,
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' || paymentMethod === 'MIXED' ? cashReceived : undefined,
      });
      setCart([]);
      setCashReceived(0);
      setDiscountRate(0);
      await loadProducts();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [cart, paymentMethod, cashReceived, total]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-red-100 text-red-700 px-6 py-4 rounded shadow">
          <strong>Error:</strong> {error}
        </div>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={loadProducts}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 text-text-strong">
      <div className="px-8 py-5 border-b border-border-subtle bg-surface-1 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-primary flex items-center justify-center text-bg shadow-sm">
            <ShoppingCart size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black uppercase tracking-[0.24em]">Caja principal</p>
            <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
              <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">Sucursal Central</span>
              <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">Caja 01</span>
              <span className="px-3 py-2 bg-white border border-border-subtle rounded-2xl">{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className={`px-3 py-2 rounded-2xl font-black ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {isOnline ? 'Conectado' : 'Sin conexión'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="px-4 py-3 bg-white border border-border-subtle rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all">
            Sync
          </button>
          <button className="px-4 py-3 bg-white border border-border-subtle rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all">
            Alertas
          </button>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border-subtle rounded-2xl shadow-sm">
            <UserPlus size={18} className="text-primary" />
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-text-strong">{user?.name || 'Operador'}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">{user?.role || 'Cajero'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="h-full flex flex-col gap-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.95fr] gap-6">
            <div className="rounded-[32px] bg-white border border-border-subtle shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-text-strong">Buscar producto</h2>
                  <p className="text-sm text-text-secondary">Escanea el código o selecciona un producto para agregarlo al ticket.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="px-4 py-3 bg-slate-50 border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.28em] text-text-secondary hover:bg-slate-100 transition-all">Escáner</button>
                  <button className="px-4 py-3 bg-slate-50 border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.28em] text-text-secondary hover:bg-slate-100 transition-all">Favoritos</button>
                  <button className="px-4 py-3 bg-slate-50 border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.28em] text-text-secondary hover:bg-slate-100 transition-all">Devolución</button>
                </div>
              </div>

              <div className="mt-6 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={search}
                  aria-label="Buscar producto"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar SKU / nombre / código..."
                  className="w-full h-14 rounded-2xl border border-border-subtle bg-slate-50 pl-12 pr-4 text-sm font-bold text-text-strong outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all ${category === cat ? 'bg-primary text-bg' : 'bg-slate-50 text-text-secondary hover:bg-slate-100'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-white border border-border-subtle shadow-sm p-6">
              <div className="mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.28em] text-text-strong">Atajos rápidos</h3>
                <p className="text-xs text-text-secondary">Accede a acciones comunes desde el ticket.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="px-4 py-4 rounded-3xl bg-slate-50 border border-border-subtle text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary hover:bg-slate-100 transition-all">Precio</button>
                <button className="px-4 py-4 rounded-3xl bg-slate-50 border border-border-subtle text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary hover:bg-slate-100 transition-all">Descuento</button>
                <button className="px-4 py-4 rounded-3xl bg-slate-50 border border-border-subtle text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary hover:bg-slate-100 transition-all">Mayoreo</button>
                <button className="px-4 py-4 rounded-3xl bg-slate-50 border border-border-subtle text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary hover:bg-slate-100 transition-all">Kardex</button>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-[32px] bg-white border border-border-subtle shadow-sm p-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-black uppercase tracking-[0.24em] text-text-strong">Productos</h3>
                <p className="text-sm text-text-secondary">Toca un producto para añadirlo al ticket.</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.28em] text-text-secondary">{filteredProducts.length} encontrados</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <motion.button
                  key={product.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(product)}
                  className="group flex flex-col rounded-3xl border border-border-subtle bg-slate-50 overflow-hidden text-left hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="h-28 bg-slate-100 overflow-hidden">
                    <img
                      src={`https://picsum.photos/seed/${product.barcode}/400/300`}
                      alt={product.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="px-4 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-text-secondary">{product.category}</p>
                      <span className={`text-[10px] font-black uppercase tracking-[0.28em] rounded-full px-2 py-1 ${product.stock <= product.minStock ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {product.stock <= product.minStock ? 'Crítico' : 'Activo'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-text-strong truncate">{product.name}</h4>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-black text-primary">{formatCurrency(product.price)}</span>
                      <span className="text-[10px] uppercase tracking-[0.28em] text-text-secondary">Stock {product.stock}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <aside className="w-full xl:w-[34%] flex flex-col rounded-[32px] bg-white border border-border-subtle shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border-subtle bg-slate-50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Cliente</p>
                <p className="text-xl font-black text-text-strong">Público General</p>
              </div>
              <button className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Cambiar</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl bg-emerald-50 text-emerald-700">En venta</span>
              <span className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl bg-slate-50 text-text-secondary">Ticket activo</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
            {cart.length > 0 ? (
              cart.map(item => (
                <div key={item.productId} className="rounded-3xl border border-border-subtle bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-text-strong truncate">{item.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-secondary">{formatCurrency(item.price)} c/u</p>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="p-2 text-text-secondary hover:text-error transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 rounded-2xl bg-white border border-border-subtle px-3 py-2">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="text-text-secondary hover:text-primary"><Minus size={14} /></button>
                      <span className="text-sm font-black min-w-[24px] text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="text-text-secondary hover:text-primary"><Plus size={14} /></button>
                    </div>
                    <span className="text-sm font-black text-text-strong">{formatCurrency(item.subtotal)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-secondary/60 gap-4">
                <ShoppingCart size={64} />
                <p className="text-sm font-black uppercase tracking-[0.28em]">Ticket vacío</p>
                <p className="text-xs text-center text-text-secondary">Agrega artículos desde el catálogo para iniciar el cobro.</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border-subtle space-y-4 bg-slate-50">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-white border border-border-subtle p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Subtotal</p>
                <p className="text-xl font-black text-text-strong">{formatCurrency(subtotal)}</p>
              </div>
              <div className="rounded-3xl bg-white border border-border-subtle p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">IVA 16%</p>
                <p className="text-xl font-black text-text-strong">{formatCurrency(taxes)}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-text-secondary">Total</p>
                <p className="text-2xl font-black text-text-strong">{formatCurrency(total)}</p>
              </div>
              <p className="text-[11px] text-text-secondary">Método: {paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : paymentMethod === 'MIXED' ? 'Mixto' : 'Crédito'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['CASH', 'CARD', 'MIXED', 'CREDIT'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`px-4 py-4 rounded-3xl border text-[10px] font-black uppercase tracking-[0.3em] transition-all ${paymentMethod === method ? 'bg-primary text-bg border-primary' : 'bg-slate-50 border-border-subtle text-text-secondary hover:bg-slate-100'}`}
                >
                  {method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'MIXED' ? 'Mixto' : 'Crédito'}
                </button>
              ))}
            </div>

            {(paymentMethod === 'CASH' || paymentMethod === 'MIXED') && (
              <div className="mt-4 rounded-3xl bg-white border border-border-subtle p-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Recibido</label>
                <input
                  type="number"
                  min="0"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border border-border-subtle px-4 py-3 text-sm font-bold text-text-strong outline-none focus:border-primary"
                />
                <p className="mt-2 text-[11px] text-text-secondary">Cambio estimado: {formatCurrency(change)}</p>
              </div>
            )}

            <div className="mt-4 rounded-3xl bg-white border border-border-subtle p-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Descuento %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-border-subtle px-4 py-3 text-sm font-bold text-text-strong outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full py-4 rounded-3xl bg-primary text-bg font-black uppercase tracking-[0.3em] shadow-lg shadow-primary/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? 'Procesando...' : 'Cobrar'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
