import React, { useState, useEffect, useMemo, useCallback } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { Plus, Search, Trash2, Edit, Upload } from 'lucide-react';
import { ProductView, CreateProductInput, UpdateProductInput } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { normalizeText, errorMessage, formatCurrency } from '../utils/helpers';
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
      title: 'Inventario Importado',
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
    <div className="view-shell p-4 lg:p-8 h-full flex flex-col relative text-slate-900 dark:text-[#E2E8F0] transition-colors">
      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar Objeto Maestro"
          message={`¿Confirmas la eliminación permanente del registro "${confirmDelete.name}"?`}
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

      <div className="flex flex-col md:flex-row md:justify-between tracking-tight gap-4 mb-6 lg:mb-8">
        <div>
          <p className="section-kicker">Catalogo vivo</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-[-0.06em]">
            Maestro de Materiales ERP
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="btn-secondary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"
          >
            <Upload size={18} /> Importar
          </button>
          <button
            onClick={() => setIsEditing({ category: 'Abarrotes', stock: 0, minStock: 5 })}
            className="btn-primary flex-1 md:flex-none justify-center text-xs px-4 py-3 flex items-center gap-2"
          >
            <Plus size={18} /> Crear Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="mini-metric">
          <p>Valor inventario</p>
          <strong>{formatCurrency(inventoryValue)}</strong>
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
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Filtro maestro (Código, Nombre o Categoría)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-light transition-all outline-none"
            />
          </div>
          <div className="flex gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl">
            {stockFilterOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setStockFilter(option.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${stockFilter === option.key ? 'bg-white dark:bg-slate-700 text-primary-light shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th
                  onClick={() => toggleInventorySort('name')}
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary-light"
                >
                  Producto{sortMarker('name')}
                </th>
                <th
                  onClick={() => toggleInventorySort('category')}
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary-light"
                >
                  Categoría{sortMarker('category')}
                </th>
                <th
                  onClick={() => toggleInventorySort('price')}
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary-light text-right"
                >
                  Precio{sortMarker('price')}
                </th>
                <th
                  onClick={() => toggleInventorySort('stock')}
                  className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-primary-light text-right"
                >
                  Existencia{sortMarker('stock')}
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
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
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{p.barcode}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 uppercase">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${p.stock <= 0 ? 'bg-rose-100 text-rose-600' : p.stock <= p.minStock ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}
                    >
                      {p.stock}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setIsEditing(p)}
                        className="p-2 text-slate-400 hover:text-primary-light hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
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
      </div>
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
      cost: Number(data.cost),
      price: Number(data.price),
      stock: Number(data.stock),
      minStock: Number(data.minStock),
    };
    await onSave(data.id ? { ...normalized, id: data.id } : (normalized as CreateProductInput));
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 bg-slate-900/55 dark:bg-[#0F1115]/82 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[30px] w-full max-w-xl p-6 text-slate-900 dark:text-[#E2E8F0] transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        <p className="section-kicker mb-2">{product.id ? 'Edicion' : 'Alta'}</p>
        <h2
          id="product-form-title"
          className="text-2xl font-black text-slate-900 dark:text-white tracking-[-0.04em] mb-4"
        >
          {product.id ? 'Editar' : 'Nuevo'} Producto
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <input
            required
            placeholder="Código (ej. 12345)"
            value={data.barcode || ''}
            onChange={(e) => setData({ ...data, barcode: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            placeholder="Categoría (ej. General)"
            value={data.category || ''}
            onChange={(e) => setData({ ...data, category: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            placeholder="Nombre ('producto')"
            value={data.name || ''}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="input-premium col-span-2 p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Costo proveedor"
            value={data.cost || ''}
            onChange={(e) => setData({ ...data, cost: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Venta publico"
            value={data.price || ''}
            onChange={(e) => setData({ ...data, price: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            placeholder="Items (Stock)"
            value={data.stock || 0}
            onChange={(e) => setData({ ...data, stock: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
          <input
            required
            type="number"
            placeholder="Min Stock"
            value={data.minStock || 0}
            onChange={(e) => setData({ ...data, minStock: e.target.value })}
            className="input-premium p-3 text-slate-900 dark:text-white outline-none transition-colors"
          />
        </div>
        <div className="flex gap-4">
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
      const rows = (await readXlsxFile(file)) as unknown[][];
      const [headerRow, ...dataRows] = rows;
      if (!headerRow || dataRows.length === 0)
        throw new Error('El archivo esta vacio o no contiene productos.');
      const headers = (headerRow as unknown[]).map((value) => String(value ?? '').trim());

      const formattedProducts = dataRows.map((values: unknown[], index: number): CreateProductInput => {
        const rowObj = Object.fromEntries(
          headers.map((header, column) => [header, (values as unknown[])[column]]),
        ) as Record<string, unknown>;
        const name = String(rowObj.producto ?? rowObj.Producto ?? rowObj.Name ?? '').trim();
        const cost = Number(rowObj['Costo proveedor'] ?? rowObj.Costo ?? rowObj.cost ?? 0);
        const price = Number(rowObj['Venta publico'] ?? rowObj.Precio ?? rowObj.price ?? 0);
        const stock = Number(rowObj.Items ?? rowObj.Stock ?? rowObj.stock ?? 0);
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
    <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[30px] w-full max-w-lg p-6 text-slate-900 dark:text-[#E2E8F0]">
        <h2 className="text-2xl font-black mb-4 tracking-tighter">Importar desde Excel</h2>

        {!confirmData ? (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">
              Carga un archivo .xlsx con las columnas: <br />
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">
                producto, "Costo proveedor", "Venta publico", Items
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
