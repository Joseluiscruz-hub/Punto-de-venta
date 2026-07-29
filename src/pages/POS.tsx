import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import {
  Barcode,
  CircleCheckBig,
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  Landmark,
  ArrowDownCircle,
  Users,
  X,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  Eraser,
  Wifi,
  WifiOff,
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
import { enqueueOfflineSale } from '../data/offlineSalesQueue';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  normalizeText,
  errorMessage,
  formatCurrency,
  createOfflineId,
  hasFeature,
} from '../utils/helpers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertDialog } from '../components/AlertDialog';
import { ProductCard, ProductVisual } from '../components/pos/ProductCard';
import { Button, EmptyState, IconButton, SelectInput, TextInput } from '../components/ui';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

function shouldQueueOfflineSale(error: unknown) {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const message = errorMessage(error, '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    /^error http 5\d\d/.test(message)
  );
}

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
            title: 'Catálogo no disponible',
            message: errorMessage(error, 'No se pudo cargar el catálogo.'),
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
        showActionToast(`${product.name} está agotado`);
        return;
      }
      const currentQuantity = cart.find((item) => item.id === product.id)?.quantity ?? 0;
      if (currentQuantity >= product.stock) {
        showActionToast(`Stock máximo: ${product.stock} unidades`);
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
      const soldItems = cart.map((item) => ({ id: item.id, quantity: item.quantity }));

      const queueOfflineSale = () => {
        if (!hasFeature(tenant, 'OFFLINE'))
          throw new Error('Modo offline no disponible en tu plan.');
        const offlineId = createOfflineId();
        const offlineDate = new Date().toISOString();
        const offlineSaleData = { ...saleData, offlineDate };
        const offlineSale: Sale = {
          id: offlineId,
          tenantId: reqContext.tenantId,
          storeId: reqContext.storeId,
          cashierId: reqContext.userId,
          clientId: selectedClientId,
          datetime: offlineDate,
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
        enqueueOfflineSale({ saleId: offlineId, reqContext, saleData: offlineSaleData });
        setIsOnline(false);
        return offlineSale;
      };

      if (isOnline) {
        try {
          result = await BackendAPI.processSale(reqContext, saleData);
        } catch (error) {
          if (!shouldQueueOfflineSale(error)) throw error;
          result = queueOfflineSale();
          showActionToast('Conexión inestable: venta guardada offline');
        }
      } else {
        result = queueOfflineSale();
      }

      setCart([]);
      setSelectedClientId(undefined);
      setShowPaymentModal(false);
      setIsCartOpen(false);
      setConfirmSaleInfo(null);
      setAlertInfo({
        title: 'Venta exitosa',
        message: `Ticket #${result.id.slice(-6).toUpperCase()} generado correctamente.`,
        saleData: result,
      });

      if (isOnline) {
        try {
          const updatedProducts = await BackendAPI.getStoreProducts(reqContext);
          setProducts(updatedProducts);
        } catch (refreshError) {
          showActionToast(errorMessage(refreshError, 'Venta guardada; no se actualizó catálogo'));
        }
      } else {
        setProducts((currentProducts) =>
          currentProducts.map((product) => {
            const sold = soldItems.find((item) => item.id === product.id);
            return sold
              ? { ...product, stock: Math.max(0, product.stock - sold.quantity) }
              : product;
          }),
        );
      }
    } catch (error) {
      setAlertInfo({
        title: 'Error en transacción',
        message: errorMessage(error, 'No se pudo procesar la venta.'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (
        event.key === 'F10' &&
        cart.length > 0 &&
        !showPaymentModal &&
        !confirmSaleInfo &&
        !alertInfo
      ) {
        event.preventDefault();
        setShowPaymentModal(true);
      }

      if (event.key === 'Escape' && isCartOpen) {
        setIsCartOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [alertInfo, cart.length, confirmSaleInfo, isCartOpen, showPaymentModal]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950 animate-fadeIn">
      {confirmSaleInfo && (
        <ConfirmDialog
          title="Confirmar venta"
          message={`¿Confirmas el cobro por ${formatCurrency(cartTotal)}?`}
          onConfirm={() =>
            handleProcessSale(confirmSaleInfo.paymentMethod, confirmSaleInfo.amountTendered)
          }
          onCancel={() => setConfirmSaleInfo(null)}
        />
      )}
      {alertInfo &&
        (alertInfo.saleData ? (
          <SaleSuccessDialog sale={alertInfo.saleData} onClose={() => setAlertInfo(null)} />
        ) : (
          <AlertDialog
            title={alertInfo.title}
            message={alertInfo.message}
            onClose={() => setAlertInfo(null)}
          />
        ))}
      {showPaymentModal && (
        <PaymentModal
          total={cartTotal}
          onConfirm={(method, amountTendered) =>
            setConfirmSaleInfo({ paymentMethod: method, amountTendered })
          }
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200 dark:border-slate-800">
        <div className="pos-command border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Catálogo de productos
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {products.length} productos disponibles
                </p>
              </div>
              <div
                className={`flex items-center gap-2 text-xs font-bold ${
                  isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
                }`}
              >
                {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
                <span className="hidden sm:inline">
                  {isOnline ? 'Sincronizado' : 'Modo sin conexión'}
                </span>
              </div>
            </div>

            <div className="pos-search relative">
              <TextInput
                ref={searchInputRef}
                type="text"
                placeholder="Escanea o busca productos"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                leadingIcon={<Search size={18} />}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  const exactBarcode = products.find(
                    (product) => product.barcode === searchQuery.trim(),
                  );
                  const product =
                    exactBarcode ?? (filteredProducts.length === 1 ? filteredProducts[0] : null);
                  if (!product) return;
                  event.preventDefault();
                  addToCart(product);
                  setSearchQuery('');
                }}
                className="h-12 w-full pr-20 text-sm font-semibold"
              />
              <kbd className="search-shortcut absolute right-3 top-1/2 -translate-y-1/2">F1</kbd>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('Todos')}
                className={`category-filter ${
                  selectedCategory === 'Todos' ? 'category-filter-active' : ''
                }`}
              >
                Todos <span>{products.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`category-filter ${
                    selectedCategory === category.name ? 'category-filter-active' : ''
                  }`}
                >
                  {category.name} <span>{category.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
          {isCatalogLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="skeleton-card" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-panel h-full min-h-72">
              <EmptyState
                icon={<Barcode size={30} />}
                title="No encontramos productos"
                description="Cambia la búsqueda o selecciona otra categoría."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('Todos');
                    }}
                    className="px-4"
                  >
                    Limpiar filtros
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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

      {isCartOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm 2xl:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}
      <div
        className={`cart-drawer fixed inset-y-0 right-0 z-40 flex w-full flex-col transition-transform duration-200 sm:w-[390px] ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full 2xl:translate-x-0 2xl:static'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-primary dark:bg-emerald-950/50">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3 className="font-extrabold leading-none text-slate-900 dark:text-white">
                Venta actual
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {cartItemsCount} artículos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              onClick={() => {
                setCart([]);
                showActionToast('Carrito vaciado');
              }}
              disabled={cart.length === 0}
              className="text-slate-500 disabled:opacity-30"
              label="Vaciar carrito"
            >
              <Eraser size={18} />
            </IconButton>
            <IconButton
              onClick={() => setIsCartOpen(false)}
              className="cart-close-button"
              label="Cerrar carrito"
            >
              <X size={19} />
            </IconButton>
          </div>
        </div>

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <label className="form-label mb-2 block">Cliente</label>
          <div>
            <TextInput
              type="text"
              placeholder="Filtrar clientes..."
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              leadingIcon={<Users size={16} />}
              className="mb-2 h-11 w-full pr-4 text-xs font-semibold"
            />
            <SelectInput
              value={selectedClientId || ''}
              onChange={(event) => setSelectedClientId(event.target.value || undefined)}
              className="h-11 w-full px-3 text-xs font-semibold"
            >
              <option value="">Público General</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4 custom-scrollbar">
          {cart.map((item) => (
            <div key={item.id} className="cart-line flex gap-3 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-800">
                <ProductVisual product={item} compact />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-start justify-between">
                  <p className="truncate pr-2 text-xs font-bold text-slate-950 dark:text-white">
                    {item.name}
                  </p>
                  <p className="text-xs font-extrabold text-slate-950 dark:text-white tabular-nums">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="flex h-7 w-7 items-center justify-center text-slate-500 hover:text-primary"
                      aria-label={`Quitar una unidad de ${item.name}`}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center text-xs font-extrabold text-slate-950 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="flex h-7 w-7 items-center justify-center text-slate-500 hover:text-primary"
                      aria-label={`Agregar una unidad de ${item.name}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <IconButton
                    onClick={() => updateQuantity(item.id, -item.quantity)}
                    className="h-8 w-8 text-slate-400 hover:text-error"
                    label={`Eliminar ${item.name} del carrito`}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <EmptyState
              icon={<ShoppingCart size={26} />}
              title="Aún no hay productos"
              description="Selecciona un producto o escanea su código."
            />
          )}
        </div>

        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total a pagar
              </p>
              <p className="mt-1 text-xs text-slate-400">{cartItemsCount} artículos</p>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-950 dark:text-slate-50 tabular-nums">
              {formatCurrency(cartTotal)}
            </h2>
          </div>

          <Button
            variant="primary"
            disabled={cart.length === 0 || isProcessing}
            onClick={() => setShowPaymentModal(true)}
            icon={<Wallet size={18} />}
            className="h-12 w-full gap-2"
          >
            {isProcessing ? 'Procesando...' : 'Cobrar'}
            <kbd className="checkout-shortcut ml-auto border-white/25 bg-white/10 text-white">
              F10
            </kbd>
          </Button>
        </div>
      </div>

      {actionToast && (
        <div className="toast-floating fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 2xl:bottom-6">
          {actionToast}
        </div>
      )}

      <button onClick={() => setIsCartOpen(true)} className="mobile-cart-bar 2xl:hidden">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart size={20} />
            {cartItemsCount > 0 && (
              <span className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-primary">
                {cartItemsCount}
              </span>
            )}
          </div>
          <span>Ver venta</span>
        </div>
        <strong className="tabular-nums">{formatCurrency(cartTotal)}</strong>
      </button>
    </div>
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
  const quickAmounts = useMemo(() => {
    const rounded = Math.ceil(total / 50) * 50;
    return Array.from(new Set([total, rounded, rounded + 50, rounded + 100]));
  }, [total]);

  const paymentOptions: Array<{
    key: PaymentMethod;
    label: string;
    icon: ReactNode;
  }> = [
    { key: 'CASH', label: 'Efectivo', icon: <Wallet size={22} /> },
    { key: 'CARD', label: 'Tarjeta', icon: <CreditCard size={22} /> },
    { key: 'TRANSFER', label: 'Transferencia', icon: <Landmark size={22} /> },
    { key: 'MIXED', label: 'Mixto', icon: <ArrowLeftRight size={22} /> },
  ];

  const amountNum = parseFloat(amount) || 0;
  const requiresCashAmount = method === 'CASH' || method === 'MIXED';
  const amountTendered = requiresCashAmount ? amountNum : total;
  const change = amountNum - total;
  const mixedRemainder = Math.max(0, total - amountNum);
  const isInvalid =
    (method === 'CASH' && amountNum < total) ||
    (method === 'MIXED' && (amountNum <= 0 || amountNum >= total));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isInvalid) onConfirm(method, amountTendered);
        }}
        className="modal-card w-full max-w-lg p-5 animate-slideInUp sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Cobro</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">
              Finalizar venta
            </h2>
          </div>
          <IconButton onClick={onClose} label="Cerrar">
            <X size={19} />
          </IconButton>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {paymentOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                setMethod(option.key);
                setAmount(option.key === 'MIXED' ? '' : total.toString());
              }}
              type="button"
              className={`payment-option ${method === option.key ? 'payment-option-active' : ''}`}
            >
              {option.icon}
              <span className="text-xs font-bold">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total</p>
              <p className="text-2xl font-extrabold text-slate-950 dark:text-white tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
            {requiresCashAmount ? (
              <div className="space-y-2">
                <label htmlFor="payment-amount" className="form-label">
                  {method === 'MIXED' ? 'Efectivo Recibido' : 'Monto Recibido'}
                </label>
                <TextInput
                  id="payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-14 w-full px-4 text-2xl font-extrabold tabular-nums"
                  autoFocus
                />
                {method === 'CASH' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAmount(value.toString())}
                        className={`quick-cash ${amountNum === value ? 'quick-cash-active' : ''}`}
                      >
                        {formatCurrency(value)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Cobro completo por {PAYMENT_LABELS[method].toLowerCase()}
              </div>
            )}
          </div>

          {method === 'CASH' && (
            <div
              className={`flex items-center justify-between border p-4 ${
                isInvalid
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowDownCircle size={20} />
                <p className="text-sm font-bold">{isInvalid ? 'Faltante' : 'Cambio a Entregar'}</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">
                {formatCurrency(Math.abs(change))}
              </p>
            </div>
          )}

          {method === 'MIXED' && (
            <div
              className={`flex items-center justify-between border p-4 ${
                isInvalid
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowLeftRight size={20} />
                <p className="text-sm font-bold">
                  {isInvalid ? 'Efectivo inválido' : 'Restante electrónico'}
                </p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">
                {formatCurrency(mixedRemainder)}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button variant="secondary" onClick={onClose} className="h-11 flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isInvalid} className="h-11 flex-1">
              Completar venta
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SaleSuccessDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="modal-card w-full max-w-sm p-6 animate-slideInUp">
        <div className="flex h-12 w-12 items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <CircleCheckBig size={27} />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-white">
          Venta completada
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ticket #{sale.id.slice(-8).toUpperCase()}
        </p>

        <div className="my-6 border-y border-slate-200 py-5 dark:border-slate-800">
          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-semibold text-slate-500">Total cobrado</span>
            <strong className="text-3xl font-extrabold text-slate-950 dark:text-white tabular-nums">
              {formatCurrency(sale.total)}
            </strong>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">Método</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {PAYMENT_LABELS[sale.paymentMethod]}
            </span>
          </div>
        </div>

        <Button onClick={onClose} variant="primary" className="h-12 w-full">
          Continuar
        </Button>
      </div>
    </div>
  );
}
