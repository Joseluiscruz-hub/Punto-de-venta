import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Landmark,
  ArrowDownCircle,
  Users,
  X,
  Printer,
  Wallet,
} from 'lucide-react';
import {
  ProductView,
  Sale,
  Client,
  PaymentMethod,
  ProcessSaleInput,
  SaleItemWithName,
} from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  normalizeText,
  errorMessage,
  formatCurrency,
  productInitials,
  createOfflineId,
  hasFeature,
} from '../utils/helpers';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function POSView() {
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
  const [cart, setCart] = useState<(ProductView & { quantity: number; subtotal: number })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 140);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmSaleInfo, setConfirmSaleInfo] = useState<{
    paymentMethod: PaymentMethod;
    amountTendered: number;
  } | null>(null);
  const [alertInfo, setAlertInfo] = useState<{
    title: string;
    message: string;
    saleData?: Sale;
  } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // CRM State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [clientSearch, setClientSearch] = useState('');

  const showActionToast = useCallback((message: string) => {
    setActionToast(message);
    window.setTimeout(
      () => setActionToast((current) => (current === message ? null : current)),
      1800,
    );
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
        if (active)
          setAlertInfo({
            title: 'Catalogo no disponible',
            message: errorMessage(error, 'No se pudo cargar el catalogo.'),
          });
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reqContext]);

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.phone?.includes(clientSearch),
      ),
    [clients, clientSearch],
  );

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
    return products.filter((product) => {
      const inCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      const matchesQuery =
        !query ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.category).includes(query) ||
        product.barcode.toLowerCase().includes(query);
      return inCategory && matchesQuery;
    });
  }, [products, debouncedSearchQuery, selectedCategory]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback(
    (product: ProductView) => {
      if (product.stock <= 0) {
        showActionToast(`${product.name} esta agotado`);
        return;
      }
      const currentQuantity = cart.find((item) => item.id === product.id)?.quantity ?? 0;
      if (currentQuantity >= product.stock) {
        showActionToast(`Stock maximo: ${product.stock} unidades`);
        return;
      }
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
              : item,
          );
        }
        return [...prev, { ...product, quantity: 1, subtotal: product.price }];
      });
      showActionToast(`${product.name} agregado`);
    },
    [cart, showActionToast],
  );

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== productId) return item;
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty > item.stock) {
            showActionToast(`Solo hay ${item.stock} en stock`);
            return item;
          }
          return { ...item, quantity: newQty, subtotal: newQty * item.price };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const handleProcessSale = async (paymentMethod: PaymentMethod, amountTendered: number) => {
    setIsProcessing(true);
    try {
      const saleData: ProcessSaleInput = {
        items: cart,
        paymentMethod,
        amountTendered,
        clientId: selectedClientId,
      };

      let result: Sale;
      if (isOnline) {
        result = await BackendAPI.processSale(reqContext, saleData);
      } else {
        if (!hasFeature(tenant, 'OFFLINE'))
          throw new Error('Modo offline no disponible en tu plan.');
        const offlineId = createOfflineId();
        const offlineSale: Sale = {
          id: offlineId,
          tenantId: reqContext.tenantId,
          storeId: reqContext.storeId,
          cashierId: reqContext.userId,
          clientId: selectedClientId,
          datetime: new Date().toISOString(),
          total: cartTotal,
          paymentMethod,
          amountTendered,
          changeAmount: paymentMethod === 'CASH' ? amountTendered - cartTotal : 0,
          itemsCount: cartItemsCount,
          items: cart.map((item) => ({
            id: createOfflineId(),
            productId: item.id,
            saleId: offlineId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            subtotal: item.subtotal,
          })) as SaleItemWithName[],
        };
        const offlineSales = JSON.parse(localStorage.getItem('offline_sales') ?? '[]');
        offlineSales.push({ saleId: offlineId, reqContext, saleData });
        localStorage.setItem('offline_sales', JSON.stringify(offlineSales));
        result = offlineSale;
      }

      setCart([]);
      setSelectedClientId(undefined);
      setShowPaymentModal(false);
      setConfirmSaleInfo(null);
      setAlertInfo({
        title: 'Venta Exitosa',
        message: `Ticket #${result.id.slice(-6).toUpperCase()} generado correctamente.`,
        saleData: result,
      });

      const updatedProducts = await BackendAPI.getStoreProducts(reqContext);
      setProducts(updatedProducts);
    } catch (error) {
      setAlertInfo({
        title: 'Error en Transacción',
        message: errorMessage(error, 'No se pudo procesar la venta.'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#f8fafc] dark:bg-slate-950 transition-colors animate-fadeIn">
      {confirmSaleInfo && (
        <ConfirmDialog
          title="Confirmar Movimiento"
          message={`¿Estás seguro de completar la venta por ${formatCurrency(cartTotal)}?`}
          onConfirm={() =>
            handleProcessSale(confirmSaleInfo.paymentMethod, confirmSaleInfo.amountTendered)
          }
          onCancel={() => setConfirmSaleInfo(null)}
        />
      )}
      {alertInfo && (
        <SaleSuccessDialog sale={alertInfo.saleData!} onClose={() => setAlertInfo(null)} />
      )}
      {showPaymentModal && (
        <PaymentModal
          total={cartTotal}
          onConfirm={(m, a) => setConfirmSaleInfo({ paymentMethod: m, amountTendered: a })}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100 dark:border-slate-800">
        <div className="p-4 lg:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Escanea o busca productos (F1)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-none rounded-[20px] shadow-sm text-sm focus:ring-2 focus:ring-primary-light transition-all outline-none font-medium"
              />
            </div>
            <div className="flex gap-1 bg-white dark:bg-slate-900 p-1 rounded-[20px] shadow-sm">
              <button
                onClick={() => setSelectedCategory('Todos')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${selectedCategory === 'Todos' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Todos
              </button>
              {categories.slice(0, 3).map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${selectedCategory === cat.name ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-6 custom-scrollbar">
          {isCatalogLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-bold animate-pulse">Sincronizando Catálogo ERP...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div
        className={`
        fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 flex flex-col transition-transform duration-300
        ${isCartOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0 xl:static'}
      `}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white leading-none">Tu Carrito</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {cartItemsCount} artículos
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="xl:hidden p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="relative group">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 mb-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-light"
            />
            <select
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value || undefined)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary-light transition-all"
            >
              <option value="">Público General</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.map((item) => (
            <div key={item.id} className="flex gap-4 group">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 font-black text-slate-400 text-xs">
                {productInitials(item.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate pr-2">
                    {item.name}
                  </p>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-[10px] font-black text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => updateQuantity(item.id, -item.quantity)}
                    className="p-1.5 text-slate-300 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-200">
                <ShoppingCart size={40} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">Carrito Vacío</p>
                <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-1">
                  Empieza a cobrar
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-end mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total a Pagar
            </p>
            <h2 className="text-3xl font-black text-primary-light tracking-tighter tabular-nums">
              {formatCurrency(cartTotal)}
            </h2>
          </div>

          <button
            disabled={cart.length === 0 || isProcessing}
            onClick={() => setShowPaymentModal(true)}
            className="w-full py-4 bg-primary hover:bg-primary-light disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isProcessing ? 'Procesando...' : 'Cobrar Ahora (F10)'}
          </button>
        </div>
      </div>

      {/* Floating UI */}
      {actionToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {actionToast}
        </div>
      )}

      <button
        onClick={() => setIsCartOpen(true)}
        className="xl:hidden fixed bottom-6 right-6 z-30 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-95"
      >
        <div className="relative">
          <ShoppingCart size={24} />
          {cartItemsCount > 0 && (
            <span className="absolute -top-3 -right-3 w-6 h-6 bg-accent text-white text-[10px] font-black rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center animate-bounce">
              {cartItemsCount}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

function ProductCard({ product, onClick }: { product: ProductView; onClick: () => void }) {
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
  const isOutOfStock = product.stock <= 0;

  return (
    <button
      onClick={onClick}
      disabled={isOutOfStock}
      className={`
        group relative flex flex-col text-left bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 disabled:opacity-60 disabled:hover:translate-y-0 animate-fadeIn
      `}
    >
      <div className="w-full aspect-square bg-slate-50 dark:bg-slate-800 rounded-2xl mb-4 flex items-center justify-center font-black text-slate-300 text-2xl group-hover:scale-105 transition-transform">
        {productInitials(product.name)}
      </div>

      <div className="flex-1">
        <p className="text-[10px] font-bold text-primary-light uppercase tracking-widest mb-1">
          {product.category}
        </p>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2 h-10">
          {product.name}
        </h4>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800">
        <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">
          {formatCurrency(product.price)}
        </p>
        <div
          className={`
          text-[10px] font-black px-2 py-1 rounded-lg
          ${isOutOfStock ? 'bg-rose-100 text-rose-600' : isLowStock ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
        `}
        >
          {isOutOfStock ? 'AGOTADO' : `${product.stock} DISP`}
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
          <Plus size={16} />
        </div>
      </div>
    </button>
  );
}

function PaymentModal({
  total,
  onConfirm,
  onClose,
}: {
  total: number;
  onConfirm: (m: PaymentMethod, a: number) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(total.toString());
  const amountNum = parseFloat(amount) || 0;
  const change = amountNum - total;
  const isInvalid = method === 'CASH' && amountNum < total;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] w-full max-w-lg shadow-2xl border border-white/20 dark:border-slate-800 animate-slideInUp">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-8">
          Finalizar Venta
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setMethod('CASH')}
            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 ${method === 'CASH' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
          >
            <Wallet size={32} />
            <span className="text-xs font-black uppercase tracking-widest">Efectivo</span>
          </button>
          <button
            onClick={() => setMethod('CARD')}
            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 ${method === 'CARD' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
          >
            <Landmark size={32} />
            <span className="text-xs font-black uppercase tracking-widest">Tarjeta</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[24px] border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Importe Total
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Monto Recibido
              </p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl text-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-light transition-all tabular-nums"
                autoFocus
              />
            </div>
          </div>

          {method === 'CASH' && (
            <div
              className={`p-6 rounded-[24px] border flex justify-between items-center transition-colors ${isInvalid ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}
            >
              <div className="flex items-center gap-3">
                <ArrowDownCircle size={24} />
                <p className="text-xs font-bold uppercase tracking-widest">
                  {isInvalid ? 'Faltante' : 'Cambio a Entregar'}
                </p>
              </div>
              <p className="text-2xl font-black tabular-nums">{formatCurrency(Math.abs(change))}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={onClose} className="btn-secondary flex-1 py-4 text-xs">
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(method, amountNum)}
              disabled={isInvalid}
              className="btn-primary flex-1 py-4 text-xs shadow-xl shadow-primary/20"
            >
              Completar Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaleSuccessDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-primary/95 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-sm text-center text-white animate-slideInUp">
        <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
          <Printer size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter mb-4">¡Venta Realizada!</h2>
        <p className="text-white/60 font-medium mb-12">
          Ticket #{sale.id.slice(-8).toUpperCase()} generado y enviado al sistema de impresión
          central.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 mb-12 text-left">
          <div className="flex justify-between items-end mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Total Cobrado
            </p>
            <p className="text-4xl font-black tracking-tighter">{formatCurrency(sale.total)}</p>
          </div>
          <div className="flex justify-between text-xs font-bold text-white/40">
            <span>METODO</span>
            <span className="text-white uppercase tracking-widest">{sale.paymentMethod}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-5 bg-white text-primary rounded-[20px] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-transform"
        >
          Aceptar y Continuar
        </button>
      </div>
    </div>
  );
}