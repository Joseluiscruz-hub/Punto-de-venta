import { useState, useEffect, useMemo } from 'react';
import {
  Search, Grid, Tag, UserPlus, Trash2, Banknote,
  CreditCard, RefreshCw, Layers, Star, Plus, Minus,
  Printer, X, CheckCircle2, History, ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import { useAuth } from '../../contexts/AuthContext';
import type { Product, SaleItem, PaymentMethod, Sale } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';

const { user } = useAuth();
const [products, setProducts] = useState<Product[]>([]);
const [cart, setCart] = useState<SaleItem[]>([]);
const [search, setSearch] = useState('');
const [category, setCategory] = useState('Todas');
const [isProcessing, setIsProcessing] = useState(false);
const [showReceipt, setShowReceipt] = useState(false);
const [lastSale, setLastSale] = useState<Sale | null>(null);
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  loadProducts();
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

const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

const filteredProducts = useMemo(() => {
  return products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesCategory = category === 'Todas' || p.category === category;
    return matchesSearch && matchesCategory;
  });
}, [products, search, category]);

// Renderizar error si existe
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

import { useCallback } from 'react';

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


const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
const taxes = useMemo(() => subtotal * 0.16, [subtotal]);
const total = useMemo(() => subtotal + taxes, [subtotal, taxes]);

const handleCheckout = useCallback(async () => {
  if (cart.length === 0) return;
  setIsProcessing(true);
  try {
    const sale = await BackendAPI.processSale({
      items: cart,
      paymentMethod,
      cashReceived: total,
    });
    setLastSale(sale);
    setShowReceipt(true);
    setCart([]);
    loadProducts();
  } catch (error: any) {
    alert(error.message);
  } finally {
    setIsProcessing(false);
  }
}, [cart, paymentMethod, total]);

return (
  <div className="flex h-full bg-bg text-text-strong overflow-hidden font-sans">

    {/* Columna Izquierda (22%): Navegación y Cliente */}
    <div className="w-[22%] border-r border-border-subtle flex flex-col bg-surface-1">
      <div className="p-6 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
          <input
            type="text"
            placeholder="Escanear o buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 bg-bg border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-4">Categorías</p>
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-enterprise ${category === cat ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-secondary hover:bg-surface-2'
                }`}
            >
              <div className="flex items-center gap-3">
                <Layers size={14} />
                <span className="text-xs font-black uppercase tracking-wider">{cat}</span>
              </div>
              {category === cat && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-lg shadow-primary/40"></div>}
            </button>
          ))}
        </div>

        <div className="pt-6">
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-4">Atajos Operativos</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex flex-col items-center justify-center gap-2 p-4 bg-surface-2 border border-border-subtle rounded-xl hover:border-primary transition-enterprise">
              <Star size={16} className="text-alert" />
              <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Favoritos</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-4 bg-surface-2 border border-border-subtle rounded-xl hover:border-primary transition-enterprise">
              <RefreshCw size={16} className="text-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Devolución</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-border-subtle bg-surface-2/30">
        <button className="w-full flex items-center gap-4 p-4 bg-surface-2 border border-border-subtle rounded-2xl hover:border-primary transition-enterprise">
          <div className="w-10 h-10 rounded-xl bg-bg border border-border-subtle flex items-center justify-center text-text-secondary">
            <UserPlus size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest leading-none mb-1">Cliente</p>
            <p className="text-xs font-black text-text-strong">Público General</p>
          </div>
        </button>
      </div>
    </div>

    {/* Columna Central (43%): Grid de Productos */}
    <div className="w-[43%] flex flex-col bg-bg border-r border-border-subtle">
      <div className="p-6 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <Grid size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Catálogo de Artículos</span>
        </div>
        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{filteredProducts.length} Resultados</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
        {filteredProducts.map(product => (
          <motion.button
            key={product.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => addToCart(product)}
            className="group flex flex-col bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden hover:border-primary transition-enterprise text-left"
          >
            <div className="h-32 bg-surface-2 relative overflow-hidden">
              <img
                src={`https://picsum.photos/seed/${product.barcode}/400/300`}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 backdrop-blur-sm">
                  Stock: {product.stock}
                </span>
                {product.stock <= product.minStock && <div className="w-2 h-2 rounded-full bg-error shadow-lg shadow-error/40"></div>}
              </div>
            </div>
            <div className="p-4 space-y-1">
              <h4 className="text-xs font-black text-text-strong truncate">{product.name}</h4>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price)}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>

    {/* Columna Derecha (35%): Ticket Actual */}
    <div className="w-[35%] flex flex-col bg-surface-1 relative">
      <div className="p-6 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Ticket de Venta</h3>
        <button onClick={() => setCart([])} className="text-text-secondary hover:text-error transition-colors p-1">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
        <AnimatePresence>
          {cart.map(item => (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="group bg-surface-2 border border-border-subtle rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-text-strong truncate">{item.name}</h4>
                <p className="text-[10px] font-bold text-text-secondary">{formatCurrency(item.price)} c/u</p>
              </div>
              <div className="flex items-center bg-bg border border-border-subtle rounded-xl p-1 gap-3">
                <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 text-text-secondary hover:text-primary"><Minus size={14} /></button>
                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 text-text-secondary hover:text-primary"><Plus size={14} /></button>
              </div>
              <div className="text-right min-w-[70px]">
                <p className="text-sm font-black text-primary">{formatCurrency(item.subtotal)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary/20 gap-4">
            <ShoppingCart size={80} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Esperando escaneo...</p>
          </div>
        )}
      </div>

      {/* Resumen de Pago */}
      <div className="p-8 bg-bg border-t border-border-subtle space-y-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-text-secondary">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-text-secondary">
            <span>Impuestos (IVA 16%)</span>
            <span>{formatCurrency(taxes)}</span>
          </div>
          <div className="flex justify-between items-end pt-2">
            <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1">Total a Pagar</span>
            <span className="text-4xl font-black text-text-strong tracking-tighter">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMethod('CASH')}
            className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-enterprise ${paymentMethod === 'CASH' ? 'bg-primary text-bg border-primary' : 'bg-surface-2 text-text-secondary border-border-subtle'
              }`}
          >
            <Banknote size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Efectivo</span>
          </button>
          <button
            onClick={() => setPaymentMethod('CARD')}
            className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-enterprise ${paymentMethod === 'CARD' ? 'bg-primary text-bg border-primary' : 'bg-surface-2 text-text-secondary border-border-subtle'
              }`}
          >
            <CreditCard size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest">Tarjeta</span>
          </button>
        </div>

        <button
          disabled={cart.length === 0 || isProcessing}
          onClick={handleCheckout}
          className="w-full h-20 bg-primary hover:bg-primary-dark disabled:bg-surface-2 disabled:text-text-secondary/30 text-bg font-black rounded-2xl shadow-2xl shadow-primary/20 transition-enterprise flex justify-center items-center gap-3 uppercase tracking-[0.3em] text-xl"
        >
          {isProcessing ? (
            <div className="w-8 h-8 border-4 border-bg/20 border-t-bg rounded-full animate-spin"></div>
          ) : (
            <>Procesar Cobro</>
          )}
        </button>
      </div>

      {/* Barra Inferior Fija (Atajos Rápidos) */}
      <div className="absolute bottom-0 left-0 w-full h-12 bg-surface-2 border-t border-border-subtle flex items-center px-6 justify-between no-print">
        <div className="flex gap-6">
          <button className="text-[9px] font-black text-text-secondary hover:text-primary uppercase tracking-widest flex items-center gap-2">
            <Tag size={12} /> Descuento (F2)
          </button>
          <button className="text-[9px] font-black text-text-secondary hover:text-primary uppercase tracking-widest flex items-center gap-2">
            <History size={12} /> Suspender (F4)
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary">
            <div className="w-2 h-2 rounded-full bg-success"></div>
            Terminal 01
          </div>
        </div>
      </div>
    </div>

    {/* Recibo Térmico (Modal optimizado) */}
    <AnimatePresence>
      {showReceipt && lastSale && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-bg/90 backdrop-blur-md no-print">
          <div className="bg-surface-1 border border-border-subtle p-8 rounded-[32px] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-success/10 text-success p-2 rounded-lg"><CheckCircle2 size={24} /></div>
                <h3 className="text-lg font-black uppercase tracking-tighter">Venta Exitosa</h3>
              </div>
              <button onClick={() => setShowReceipt(false)} className="text-text-secondary hover:text-text-strong"><X size={20} /></button>
            </div>

            <div className="bg-[#faf9f6] text-bg p-8 rounded-2xl font-mono text-[11px] mb-8 shadow-inner overflow-hidden relative">
              <div className="text-center mb-4 font-black text-sm uppercase tracking-tighter">RETAIL OS - TICKET</div>
              <div className="border-b border-dashed border-bg/20 pb-4 mb-4 space-y-1">
                <p className="flex justify-between"><span>Folio:</span> <span>#{lastSale.id}</span></p>
                <p className="flex justify-between"><span>Atendió:</span> <span>{user?.name}</span></p>
              </div>
              <div className="space-y-2 mb-4">
                {lastSale.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-bg pt-4 flex justify-between font-black text-sm uppercase">
                <span>Total:</span>
                <span>{formatCurrency(lastSale.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => window.print()} className="h-14 bg-bg text-text-strong border border-border-subtle rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                <Printer size={16} /> Imprimir
              </button>
              <button onClick={() => setShowReceipt(false)} className="h-14 bg-primary text-bg rounded-xl font-black uppercase tracking-widest text-[10px]">
                Nueva Venta
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

  </div>
);
}
