import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { readSheet } from 'read-excel-file/browser';
import { Plus, Search, Trash2, Edit, Upload } from 'lucide-react';
import { ProductView, CreateProductInput, UpdateProductInput } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { normalizeText, errorMessage, formatCurrency } from '../utils/helpers';
import { optimizedCatalogImageSrc } from '../utils/images';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertDialog } from '../components/AlertDialog';

type StockFilter = 'ALL' | 'LOW' | 'OUT';
type InventorySortKey = 'name' | 'category' | 'price' | 'stock';
type SortDirection = 'asc' | 'desc';

interface ProductFormData {
  id?: string;
  barcode?: string;
  name?: string;
  category?: string;
  imageUrl?: string;
  cost?: number | string;
  price?: number | string;
  stock?: number | string;
  minStock?: number | string;
}

export function InventoryView() {
  const { reqContext } = useAuth();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 140);
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [inventorySort, setInventorySort] = useState<{
    key: InventorySortKey;
    direction: SortDirection;
  }>({ key: 'name', direction: 'asc' });
  const [isEditing, setIsEditing] = useState<ProductFormData | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductView | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback(
    () => BackendAPI.getStoreProducts(reqContext).then(setProducts),
    [reqContext],
  );
  useEffect(() => {
    let active = true;
    BackendAPI.getStoreProducts(reqContext).then((data) => {
      if (active) setProducts(data);
    });
    return () => {
      active = false;
    };
  }, [reqContext]);

  const handleSave = async (data: CreateProductInput | UpdateProductInput) => {
    try {
      await BackendAPI.saveProduct(reqContext, data);
      await loadData();
      setIsEditing(null);
      setAlertInfo({ title: 'Éxito', message: 'El producto se guardó correctamente.' });
    } catch (error) {
      setAlertInfo({
        title: 'Error',
        message: errorMessage(error, 'No se pudo guardar el producto'),
      });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await BackendAPI.deleteProduct(reqContext, confirmDelete.id);
      await loadData();
      setConfirmDelete(null);
      setAlertInfo({
        title: 'Producto Eliminado',
        message: 'El producto fue eliminado permanentemente.',
      });
    } catch (error) {
      setAlertInfo({
        title: 'Error',
        message: errorMessage(error, 'No se pudo eliminar el producto'),
      });
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkImport(false);
    setAlertInfo({
      title: 'Inventario importado',
      message: 'Los productos se importaron exitosamente.',
    });
    loadData();
  };

  const stockFilterOptions: Array<{ key: StockFilter; label: string; count: number }> = [
    { key: 'ALL', label: 'Todos', count: products.length },
    {
      key: 'LOW',
      label: 'Bajo stock',
      count: products.filter((product) => product.stock > 0 && product.stock <= product.minStock)
        .length,
    },
    {
      key: 'OUT',
      label: 'Agotados',
      count: products.filter((product) => product.stock <= 0).length,
    },
  ];

  const toggleInventorySort = (key: InventorySortKey) => {
    setInventorySort((current) => ({
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
    const result = products.filter((product) => {
      const matchesQuery =
        !query ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.category).includes(query) ||
        product.barcode.toLowerCase().includes(query);
      const matchesStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'LOW' && product.stock > 0 && product.stock <= product.minStock) ||
        (stockFilter === 'OUT' && product.stock <= 0);
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
  const lowStockCount = products.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock,
  ).length;
  const outOfStockCount = products.filter((product) => product.stock <= 0).length;

  return (
    <div className="view-shell view-page relative animate-fadeIn">
      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar producto"
          message={`¿Confirmas la eliminación permanente de "${confirmDelete.name}"?`}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {alertInfo && (
        <AlertDialog
          title={alertInfo.title}
          message={alertInfo.message}
          onClose={() => setAlertInfo(null)}
        />
      )}
      {isEditing && (
        <ProductFormModal
          product={isEditing}
          onClose={() => setIsEditing(null)}
          onSave={handleSave}
        />
      )}
      {showBulkImport && (
        <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={handleBulkSuccess} />
      )}

      <header className="view-header">
        <div className="min-w-0">
          <p className="section-kicker">Catálogo vivo</p>
          <h1 className="view-title">Inventario</h1>
          <p className="view-description">
            Controla precios, existencias, mínimos de reposición e importaciones de producto.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setShowBulkImport(true)}
            className="btn-secondary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"
          >
            <Upload size={18} /> Importar
          </button>
          <button
            type="button"
            onClick={() => setIsEditing({ category: 'Abarrotes', stock: 0, minStock: 5 })}
            className="btn-primary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"
          >
            <Plus size={18} /> Crear producto
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="mini-metric">
          <p>Valor inventario</p>
          <strong>{formatCurrency(inventoryValue)}</strong>
        </div>
        <div className="mini-metric">
          <p>Productos activos</p>
          <strong>{products.length} SKUs</strong>
        </div>
        <div className="mini-metric">
          <p>Bajo stock</p>
          <strong className={lowStockCount > 0 ? 'text-amber-500' : ''}>
            {lowStockCount} items
          </strong>
        </div>
        <div className="mini-metric">
          <p>Agotados</p>
          <strong className={outOfStockCount > 0 ? 'text-rose-500' : ''}>
            {outOfStockCount} items
          </strong>
        </div>
      </section>

      <section className="data-panel flex flex-1 flex-col min-h-0">
        <div className="data-panel-header flex-col items-stretch md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por código, nombre o categoría"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-premium h-11 w-full pl-10 pr-4 text-sm font-semibold"
            />
          </div>
          <div
            className="segmented-control overflow-x-auto"
            role="tablist"
            aria-label="Filtro de stock"
          >
            {stockFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={stockFilter === option.key}
                onClick={() => setStockFilter(option.key)}
                className={`segmented-option ${
                  stockFilter === option.key ? 'segmented-option-active' : ''
                }`}
              >
                {option.label}
                <span className="text-[0.65rem] text-slate-400">{option.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[10px] sm:text-[11px]">
            <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th
                  onClick={() => toggleInventorySort('name')}
                  className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary-light"
                >
                  Producto{sortMarker('name')}
                </th>
                <th
                  onClick={() => toggleInventorySort('category')}
                  className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary-light"
                >
                  Categoría{sortMarker('category')}
                </th>
                <th
                  onClick={() => toggleInventorySort('price')}
                  className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary-light text-right"
                >
                  Precio{sortMarker('price')}
                </th>
                <th
                  onClick={() => toggleInventorySort('stock')}
                  className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer hover:text-primary-light text-right"
                >
                  Existencia{sortMarker('stock')}
                </th>
                <th className="px-4 sm:px-6 py-4 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.imageUrl && (
                        <img
                          src={optimizedCatalogImageSrc(p.imageUrl)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-950"
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            const fallbackSrc = p.imageUrl?.trim();
                            if (
                              fallbackSrc &&
                              event.currentTarget.dataset.fallback !== 'true' &&
                              event.currentTarget.getAttribute('src') !== fallbackSrc
                            ) {
                              event.currentTarget.dataset.fallback = 'true';
                              event.currentTarget.src = fallbackSrc;
                              return;
                            }

                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950 dark:text-white">
                          {p.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {p.barcode}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-slate-950 dark:text-white tabular-nums">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div
                      className={`status-pill ${
                        p.stock <= 0
                          ? 'status-pill-danger'
                          : p.stock <= p.minStock
                            ? 'status-pill-warning'
                            : 'status-pill-success'
                      }`}
                    >
                      {p.stock}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setIsEditing(p)}
                        aria-label={`Editar ${p.name}`}
                        className="p-2 text-slate-400 hover:text-primary-light hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        aria-label={`Eliminar ${p.name}`}
                        className="p-2 text-slate-400 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-20 text-center text-slate-400 font-medium italic"
                  >
                    No se encontraron productos coincidentes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSave,
}: {
  product: ProductFormData;
  onClose: () => void;
  onSave: (product: CreateProductInput | UpdateProductInput) => Promise<void>;
}) {
  const [data, setData] = useState<ProductFormData>(product);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const normalized = {
      barcode: data.barcode ?? '',
      name: data.name ?? '',
      category: data.category ?? '',
      imageUrl: data.imageUrl?.trim() || undefined,
      cost: Number(data.cost),
      price: Number(data.price),
      stock: Number(data.stock),
      minStock: Number(data.minStock),
    };
    try {
      await onSave(data.id ? { ...normalized, id: data.id } : (normalized as CreateProductInput));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <form
        onSubmit={submit}
        className="modal-card w-full max-w-xl p-5 text-slate-900 transition-colors animate-slideInUp dark:text-[#E2E8F0] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <p className="section-kicker mb-2">{product.id ? 'Edición' : 'Alta'}</p>
        <h2
          id="product-form-title"
          className="mb-4 text-2xl font-extrabold text-slate-950 dark:text-white"
        >
          {product.id ? 'Editar' : 'Nuevo'} producto
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <input
            required
            placeholder="Código (ej. 12345)"
            value={data.barcode || ''}
            onChange={(e) => setData({ ...data, barcode: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            placeholder="Categoría (ej. General)"
            value={data.category || ''}
            onChange={(e) => setData({ ...data, category: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            placeholder="Nombre ('producto')"
            value={data.name || ''}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="input-premium sm:col-span-2 p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            placeholder="Imagen URL o ruta local (/productos/imagen.webp)"
            value={data.imageUrl || ''}
            onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
            className="input-premium sm:col-span-2 p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Costo proveedor"
            value={data.cost || ''}
            onChange={(e) => setData({ ...data, cost: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Venta público"
            value={data.price || ''}
            onChange={(e) => setData({ ...data, price: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            placeholder="Existencia"
            value={data.stock || 0}
            onChange={(e) => setData({ ...data, stock: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            placeholder="Stock mínimo"
            value={data.minStock || 0}
            onChange={(e) => setData({ ...data, minStock: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-xs">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-xs">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      const rows = (await readSheet(file)) as unknown[][];
      const [headerRow, ...dataRows] = rows;
      if (!headerRow || dataRows.length === 0)
        throw new Error('El archivo está vacío o no contiene productos.');
      const headers = (headerRow as unknown[]).map((value) => normalizeText(String(value ?? '')));

      const formattedProducts = dataRows.map(
        (values: unknown[], index: number): CreateProductInput => {
          const rowObj = Object.fromEntries(
            headers.map((header, column) => [header, (values as unknown[])[column]]),
          ) as Record<string, unknown>;
          const cellText = (keys: string[]) =>
            String(keys.map((key) => rowObj[key]).find((value) => value != null) ?? '').trim();
          const cellNumber = (keys: string[], fallback: number) => {
            const raw = keys.map((key) => rowObj[key]).find((value) => value != null) ?? fallback;
            const value = Number(String(raw).replace(/[$,]/g, ''));
            if (!Number.isFinite(value) || value < 0)
              throw new Error(`Fila ${index + 2}: valor numérico inválido.`);
            return value;
          };
          const name = cellText(['producto', 'nombre', 'name']);
          const barcode = cellText(['codigo', 'codigo de barras', 'barcode', 'sku']);
          const category = cellText(['categoria', 'category']) || 'General';
          const imageUrl = cellText([
            'imagen',
            'image',
            'image url',
            'image_url',
            'url imagen',
            'foto',
          ]);
          const cost = cellNumber(['costo proveedor', 'costo', 'cost'], 0);
          const price = cellNumber(['venta publico', 'precio', 'price'], 0);
          const stock = cellNumber(['items', 'stock', 'existencia'], 0);
          const minStock = cellNumber(['stock minimo', 'min stock', 'minstock'], 5);
          if (!barcode) throw new Error(`Fila ${index + 2}: el código de barras es obligatorio.`);
          if (!name) throw new Error(`Fila ${index + 2}: El nombre del producto es obligatorio.`);
          if (!Number.isInteger(stock) || !Number.isInteger(minStock))
            throw new Error(`Fila ${index + 2}: stock y mínimo deben ser enteros.`);

          return {
            barcode,
            name,
            category,
            imageUrl: imageUrl || undefined,
            cost,
            price,
            stock,
            minStock,
          };
        },
      );

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
    <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="modal-card w-full max-w-lg p-6 text-slate-900 animate-slideInUp dark:text-[#E2E8F0]">
        <h2 className="mb-4 text-2xl font-extrabold">Importar desde Excel</h2>

        {!confirmData ? (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">
              Carga un archivo .xlsx con las columnas: <br />
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">
                codigo, producto, categoria, imagen, "Costo proveedor", "Venta publico", Items
              </code>
            </p>

            <div className="relative h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center hover:border-primary-light transition-colors group">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={loading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <Upload className="mx-auto text-slate-400 group-hover:text-primary-light mb-2" />
                <p className="text-xs font-bold text-slate-500">
                  {loading ? 'Procesando...' : 'Selecciona un archivo Excel'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Se detectaron {confirmData.length} productos listos para importar.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setConfirmData(null)}
                className="btn-secondary flex-1 py-3 text-xs"
              >
                Atrás
              </button>
              <button
                onClick={processImport}
                disabled={loading}
                className="btn-primary flex-1 py-3 text-xs"
              >
                Confirmar Importación
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold">
            {error}
          </div>
        )}

        {!confirmData && (
          <button
            onClick={onClose}
            className="w-full mt-4 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
