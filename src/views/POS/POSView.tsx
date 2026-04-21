import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Banknote, CreditCard, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import { useAuth } from '../../contexts/AuthContext';
import type { Product, SaleItem, PaymentMethod } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';

export default function POSView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      await BackendAPI.processSale({
        cashierId: user.id,
        items: cart,
        total: cartTotal,
        paymentMethod,
        amountTendered,
        change: amountTendered - cartTotal
      });
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
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      {/* Search and Products */}
      <div className="flex-1 flex flex-col p-8 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <div>
             <h2 className="text-3xl font-black text-slate-800">Terminal de Caja</h2>
             <p className="text-slate-500 font-medium">Registra los productos para la venta.</p>
           </div>
           <div className="relative w-96">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
             <input
               type="text"
               placeholder="Escanear o buscar producto..."
               className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-primary-500 outline-none font-medium transition-all"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               autoFocus
             />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {filteredProducts.map((product, idx) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={() => addToCart(product)} 
                delay={idx * 0.05}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800">Resumen</h2>
            <p className="text-xs text-slate-500 font-bold uppercase mt-1">Atiende: {user?.name}</p>
          </div>
          <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-black">
            {cart.length} ITEMS
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {cart.map(item => (
              <CartItemCard 
                key={item.id} 
                item={item} 
                onUpdate={updateQuantity} 
              />
            ))}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
              <ShoppingCart size={80} className="opacity-10 mb-6" />
              <p className="font-bold">El carrito está vacío</p>
              <p className="text-sm">Selecciona productos para comenzar</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-900 text-white rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.3)]">
          <div className="space-y-3 mb-8">
            <div className="flex justify-between items-center text-slate-400 font-medium">
              <span>Subtotal</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400 font-medium">
              <span>Impuestos (Incl.)</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <span className="text-xl font-bold">Total a Pagar</span>
              <span className="text-3xl font-black text-primary-400">{formatCurrency(cartTotal)}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 bg-primary-500 hover:bg-primary-400 text-white disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-xl shadow-primary-500/20 active:scale-95"
          >
            PROCEDER AL PAGO <CheckCircle2 size={24} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showPaymentModal && (
          <PaymentModal 
            total={cartTotal} 
            onClose={() => setShowPaymentModal(false)} 
            onComplete={handleCheckout} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center text-center"
          >
            <div className="space-y-6">
              <div className="w-20 h-20 border-8 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h3 className="text-2xl font-black text-white">Procesando Venta</h3>
                <p className="text-slate-400 mt-2">Actualizando inventario y generando folio...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onClick, delay }: any) {
  const isLowStock = product.stock <= product.minStock && product.stock > 0;
  const isOutOfStock = product.stock <= 0;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={!isOutOfStock ? { y: -5, transition: { duration: 0.2 } } : {}}
      whileTap={!isOutOfStock ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={isOutOfStock}
      className={`relative group flex flex-col p-6 rounded-[32px] border-2 text-left transition-all ${
        isOutOfStock 
          ? 'bg-slate-100 border-slate-200 opacity-50 grayscale' 
          : 'bg-white border-white hover:border-primary-500 shadow-sm hover:shadow-2xl hover:shadow-primary-500/10'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-black px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase tracking-wider">
          {product.category}
        </span>
        {isLowStock && (
          <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
            STOCK: {product.stock}
          </div>
        )}
        {isOutOfStock && (
          <div className="flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
            AGOTADO
          </div>
        )}
      </div>
      
      <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 group-hover:text-primary-600 transition-colors">
        {product.name}
      </h3>
      <p className="text-slate-400 text-xs font-mono mb-6">{product.barcode}</p>
      
      <div className="mt-auto flex justify-between items-center">
        <span className="text-2xl font-black text-slate-900">{formatCurrency(product.price)}</span>
        <div className={`p-2 rounded-xl transition-colors ${isOutOfStock ? 'bg-slate-200' : 'bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white'}`}>
          <Plus size={20} />
        </div>
      </div>
    </motion.button>
  );
}

function CartItemCard({ item, onUpdate }: any) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative flex gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-100 hover:bg-white hover:border-primary-200 hover:shadow-lg transition-all"
    >
      <div className="flex flex-col items-center justify-between bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm">
        <button 
          onClick={() => onUpdate(item.id, item.quantity + 1)}
          className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <Plus size={16} />
        </button>
        <span className="font-black text-sm my-1 text-slate-800">{item.quantity}</span>
        <button 
          onClick={() => onUpdate(item.id, item.quantity - 1)}
          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="flex-1 py-1">
        <h4 className="font-bold text-slate-800 text-sm leading-snug">{item.name}</h4>
        <p className="text-slate-400 text-xs mt-1 font-medium">{formatCurrency(item.price)} c/u</p>
      </div>
      
      <div className="flex flex-col items-end justify-center py-1">
        <span className="font-black text-slate-900 text-lg">{formatCurrency(item.subtotal)}</span>
      </div>
    </motion.div>
  );
}

function PaymentModal({ total, onClose, onComplete }: any) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState(total.toString());
  
  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - total;
  const isInvalid = method === 'CASH' && tenderedNum < total;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-slate-900 p-10 text-white text-center relative">
          <p className="text-primary-400 text-xs font-black uppercase tracking-[0.3em] mb-3">Total a Cobrar</p>
          <h2 className="text-5xl font-black">{formatCurrency(total)}</h2>
          <div className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent"></div>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <PaymentOption 
              active={method === 'CASH'} 
              icon={<Banknote size={32} />} 
              label="Efectivo" 
              onClick={() => { setMethod('CASH'); setTendered(total.toString()); }}
            />
            <PaymentOption 
              active={method === 'CARD'} 
              icon={<CreditCard size={32} />} 
              label="Tarjeta" 
              onClick={() => { setMethod('CARD'); setTendered(total.toString()); }}
            />
          </div>

          {method === 'CASH' && (
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Efectivo Recibido</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 text-2xl font-black">$</span>
                  <input 
                    type="number" 
                    value={tendered} 
                    onChange={(e) => setTendered(e.target.value)} 
                    className="w-full text-right text-4xl font-black p-5 pl-12 bg-white border-2 border-slate-100 rounded-2xl focus:border-primary-500 outline-none transition-all"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cambio</span>
                <span className={`text-3xl font-black ${change < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {formatCurrency(change >= 0 ? change : 0)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button 
              onClick={onClose} 
              className="flex-1 py-5 font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors"
            >
              CANCELAR
            </button>
            <button 
              onClick={() => onComplete(method, method === 'CASH' ? tenderedNum : total)} 
              disabled={isInvalid} 
              className={`flex-1 py-5 font-black rounded-2xl transition-all shadow-xl ${
                isInvalid 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-primary-600 text-white hover:bg-primary-500 shadow-primary-500/30 active:scale-95'
              }`}
            >
              CONFIRMAR
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PaymentOption({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${
        active 
          ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-lg shadow-primary-500/10' 
          : 'border-slate-100 text-slate-400 hover:border-slate-200'
      }`}
    >
      <div className={`p-3 rounded-2xl ${active ? 'bg-primary-500 text-white' : 'bg-slate-50'}`}>
        {icon}
      </div>
      <span className="font-black text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}
