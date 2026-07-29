import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { readSheet } from 'read-excel-file/browser';
import {
  Boxes,
  CircleDollarSign,
  Edit,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { ProductView, CreateProductInput, UpdateProductInput } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { normalizeText, errorMessage, formatCurrency } from '../utils/helpers';
import { optimizedCatalogImageSrc } from '../utils/images';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertDialog } from '../components/AlertDialog';
import { Button, Panel, SegmentedControl, StatusBadge, TextInput } from '../components/ui';

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
          <p className="section-kicker">Operación de inventario</p>
          <h1 className="view-title">Inventario</h1>
          <p className="view-description">
            Administra el catálogo, controla existencias y detecta productos que requieren
            reposición.
          </p>
        </div>
        <div className="inventory-actions">
          <Button
            onClick={() => setShowBulkImport(true)}
            variant="secondary"
            icon={<Upload size={18} />}
            className="gap-2 px-4"
          >
            Importar
          </Button>
          <Button
            onClick={() => setIsEditing({ category: 'Abarrotes', stock: 0, minStock: 5 })}
            variant="primary"
            icon={<Plus size={18} />}
            className="gap-2 px-4"
          >
            Nuevo producto
          </Button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Resumen de inventario">
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-brand">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <p>Valor potencial</p>
            <strong>{formatCurrency(inventoryValue)}</strong>
            <span>Existencia a precio de venta</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-neutral">
            <Boxes size={19} />
          </span>
          <div>
            <p>Productos activos</p>
            <strong>{products.length}</strong>
            <span>SKUs en catálogo</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-warning">
            <TriangleAlert size={19} />
          </span>
          <div>
            <p>Bajo stock</p>
            <strong className={lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
              {lowStockCount}
            </strong>
            <span>Productos por reponer</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-card-icon summary-card-icon-danger">
            <PackageCheck size={19} />
          </span>
          <div>
            <p>Agotados</p>
            <strong className={outOfStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}>
              {outOfStockCount}
            </strong>
            <span>Sin unidades disponibles</span>
          </div>
        </div>
      </section>

      <Panel className="flex min-h-[420px] flex-1 flex-col">
        <div className="data-panel-header inventory-toolbar">
          <div className="min-w-0">
            <h2 className="data-panel-title">Catálogo de productos</h2>
            <p className="data-panel-subtitle">
              {filtered.length} de {products.length} productos visibles
            </p>
          </div>
          <div className="inventory-toolbar-controls">
            <div className="inventory-search">
              <TextInput
                type="text"
                aria-label="Buscar productos"
                placeholder="Buscar código, producto o categoría"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingIcon={<Search size={18} />}
                className="h-11 w-full pr-4 text-sm font-semibold"
              />
            </div>
            <SegmentedControl
              ariaLabel="Filtro de stock"
              options={stockFilterOptions}
              value={stockFilter}
              onChange={setStockFilter}
              className="inventory-stock-filters"
            />
          </div>
        </div>

        <div className="inventory-card-list lg:hidden">
          {filtered.map((product) => {
            const stockTone =
              product.stock <= 0
                ? 'danger'
                : product.stock <= product.minStock
                  ? 'warning'
                  : 'success';
            const stockLabel =
              product.stock <= 0
                ? 'Agotado'
                : product.stock <= product.minStock
                  ? 'Por reponer'
                  : 'Disponible';

            return (
              <article key={product.id} className="inventory-product-card">
                <div className="inventory-product-card-header">
                  <InventoryProductThumbnail product={product} />
                  <div className="min-w-0 flex-1">
                    <h3>{product.name}</h3>
                    <p>{product.barcode}</p>
                  </div>
                  <StatusBadge tone={stockTone}>{stockLabel}</StatusBadge>
                </div>

                <dl className="inventory-product-details">
                  <div>
                    <dt>Categoría</dt>
                    <dd>{product.category}</dd>
                  </div>
                  <div>
                    <dt>Precio</dt>
                    <dd>{formatCurrency(product.price)}</dd>
                  </div>
                  <div>
                    <dt>Existencia</dt>
                    <dd>
                      {product.stock} <span>/ mín. {product.minStock}</span>
                    </dd>
                  </div>
                </dl>

                <div className="inventory-product-actions">
                  <Button
                    onClick={() => setIsEditing(product)}
                    variant="secondary"
                    icon={<Edit size={16} />}
                    className="h-10 flex-1 gap-2"
                  >
                    Editar
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(product)}
                    aria-label={`Eliminar ${product.name}`}
                    className="inventory-delete-button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <InventoryEmptyState />}
        </div>

        <div className="hidden flex-1 overflow-auto custom-scrollbar lg:block">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th onClick={() => toggleInventorySort('name')} className="cursor-pointer">
                  Producto{sortMarker('name')}
                </th>
                <th onClick={() => toggleInventorySort('category')} className="cursor-pointer">
                  Categoría{sortMarker('category')}
                </th>
                <th
                  onClick={() => toggleInventorySort('price')}
                  className="cursor-pointer text-right"
                >
                  Precio{sortMarker('price')}
                </th>
                <th
                  onClick={() => toggleInventorySort('stock')}
                  className="cursor-pointer text-right"
                >
                  Existencia{sortMarker('stock')}
                </th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <InventoryProductThumbnail product={p} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950 dark:text-white">
                          {p.name}
                        </p>
                        <p className="mt-1 font-mono text-[0.68rem] text-slate-500">{p.barcode}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="inventory-category-tag">{p.category}</span>
                  </td>
                  <td className="text-right font-bold text-slate-950 dark:text-white tabular-nums">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="text-right">
                    <StatusBadge
                      tone={p.stock <= 0 ? 'danger' : p.stock <= p.minStock ? 'warning' : 'success'}
                      title={`Mínimo configurado: ${p.minStock}`}
                    >
                      {p.stock} unidades
                    </StatusBadge>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setIsEditing(p)}
                        aria-label={`Editar ${p.name}`}
                        className="table-action-button"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        aria-label={`Eliminar ${p.name}`}
                        className="table-action-button table-action-button-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function InventoryProductThumbnail({ product }: { product: ProductView }) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = product.imageUrl?.trim();

  if (source && !imageFailed) {
    return (
      <div className="inventory-product-thumbnail">
        <img
          src={optimizedCatalogImageSrc(source)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => {
            if (
              event.currentTarget.dataset.fallback !== 'true' &&
              event.currentTarget.getAttribute('src') !== source
            ) {
              event.currentTarget.dataset.fallback = 'true';
              event.currentTarget.src = source;
              return;
            }
            setImageFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="inventory-product-thumbnail inventory-product-thumbnail-placeholder">
      <Boxes size={20} />
    </div>
  );
}

function InventoryEmptyState() {
  return (
    <div className="inventory-empty-state">
      <span>
        <Search size={22} />
      </span>
      <strong>Sin coincidencias</strong>
      <p>Prueba con otro código, nombre, categoría o filtro de existencia.</p>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-md animate-fadeIn dark:bg-[#0F1115]/82 sm:items-center">
      <form
        onSubmit={submit}
        className="modal-card my-auto max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto p-5 text-slate-900 transition-colors animate-slideInUp dark:text-[#E2E8F0] sm:p-6"
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
            aria-label="Código de producto"
            placeholder="Código (ej. 12345)"
            value={data.barcode || ''}
            onChange={(e) => setData({ ...data, barcode: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Categoría"
            placeholder="Categoría (ej. General)"
            value={data.category || ''}
            onChange={(e) => setData({ ...data, category: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Nombre del producto"
            placeholder="Nombre ('producto')"
            value={data.name || ''}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="input-premium sm:col-span-2 p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            aria-label="Imagen del producto"
            placeholder="Imagen URL o ruta local (/productos/imagen.webp)"
            value={data.imageUrl || ''}
            onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
            className="input-premium sm:col-span-2 p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Costo de proveedor"
            type="number"
            min="0"
            step="0.01"
            placeholder="Costo proveedor"
            value={data.cost || ''}
            onChange={(e) => setData({ ...data, cost: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Precio de venta"
            type="number"
            min="0"
            step="0.01"
            placeholder="Venta público"
            value={data.price || ''}
            onChange={(e) => setData({ ...data, price: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Existencia"
            type="number"
            min="0"
            placeholder="Existencia"
            value={data.stock || 0}
            onChange={(e) => setData({ ...data, stock: e.target.value })}
            className="input-premium p-3 text-slate-950 dark:text-white outline-none transition-colors"
          />
          <input
            required
            aria-label="Stock mínimo"
            type="number"
            min="0"
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
            {loading ? 'Guardando…' : 'Guardar producto'}
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
