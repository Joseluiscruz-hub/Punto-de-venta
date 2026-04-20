import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2, Barcode, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BackendAPI } from '../../api/BackendAPI';
import { Product, SaleItem, PaymentMethod } from '../../models/types';
import PaymentModal from './PaymentModal';
import { formatCurrency } from '../../utils/formatCurrency';

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
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all hover:shadow-md ${product.stock <= 0 ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-emerald-400 active:scale-95'
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
