import { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, AlertCircle, FileUp, Download } from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import type { Product, CreateProductInput } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';
import GlassCard from '../../components/common/GlassCard';
import * as XLSX from 'xlsx';

export default function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
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

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
      const matchesCategory = categoryFilter === 'Todas' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const formattedProducts: CreateProductInput[] = data.map(item => ({
          barcode: String(item.barcode || item.codigo || ''),
          name: String(item.name || item.nombre || ''),
          price: Number(item.price || item.precio || 0),
          cost: Number(item.cost || item.costo || 0),
          stock: Number(item.stock || item.existencia || 0),
          minStock: Number(item.minStock || item.minimo || 5),
          category: String(item.category || item.categoria || 'General')
        }));

        await BackendAPI.importProducts(formattedProducts);
        await loadProducts();
        alert('Importación completada con éxito');
      } catch (error) {
        console.error('Error importando:', error);
        alert('Error al procesar el archivo. Asegúrate de que el formato sea correcto.');
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { barcode: '123456', name: 'Producto Ejemplo', price: 10.5, cost: 8.0, stock: 50, minStock: 10, category: 'General' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_ElTriunfo.xlsx');
  };

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
    <div className="p-8 h-full flex flex-col space-y-8 bg-slate-50">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-500/30">
              <Package size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Stock</h1>
          </div>
          <p className="text-slate-500 font-medium">Control total del inventario de El Triunfo</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
          >
            <Download size={18} /> Plantilla
          </button>

          <label className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-emerald-100 text-emerald-600 font-black rounded-2xl hover:bg-emerald-50 transition-all cursor-pointer uppercase tracking-widest text-xs">
            <FileUp size={18} /> {isImporting ? 'Procesando...' : 'Importar Excel'}
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isImporting} />
          </label>

          <button className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all uppercase tracking-widest text-xs">
            <Plus size={18} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard className="p-6 border-emerald-500/10">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sku's</p>
              <p className="text-2xl font-black text-slate-800">{products.length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-rose-500/10">
          <div className="flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-2xl text-rose-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bajo Stock</p>
              <p className="text-2xl font-black text-slate-800">{products.filter(p => p.stock <= p.minStock).length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:col-span-2">
          <div className="flex items-center gap-4 h-full">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none transition-all font-bold"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-slate-100/50 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none font-bold text-slate-600"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </GlassCard>
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Costo</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        <img src={`https://picsum.photos/seed/${product.barcode}/100/100`} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-none mb-1">{product.name}</p>
                        <p className="text-[10px] text-text-secondary">{product.barcode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-black text-slate-700">{product.category}</td>
                  <td className="px-6 py-5 text-right text-slate-700">{formatCurrency(product.cost)}</td>
                  <td className="px-6 py-5 text-right text-slate-800 font-black">{formatCurrency(product.price)}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black ${product.stock <= product.minStock ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="px-4 py-2 rounded-2xl bg-primary text-bg text-[10px] font-black uppercase tracking-[0.28em]">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
              <Package size={64} strokeWidth={1} className="opacity-20" />
              <p className="font-black text-sm uppercase tracking-widest opacity-50">No hay productos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
