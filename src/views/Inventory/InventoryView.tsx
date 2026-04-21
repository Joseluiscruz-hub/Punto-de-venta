import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save, X, Barcode, Package, DollarSign, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import { useAuth } from '../../contexts/AuthContext';
import { Product } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';
import GlassCard from '../../components/common/GlassCard';

export default function InventoryView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<Product | Partial<Product> | null>(null);

  const loadData = () => BackendAPI.getProducts().then(setProducts);
  useEffect(() => { loadData(); }, []);

  const handleSave = async (productData: any) => {
    try {
      await BackendAPI.saveProduct(productData, user!.id);
      await loadData();
      setIsEditing(null);
    } catch (e: any) {
      alert("Error guardando: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) {
      await BackendAPI.deleteProduct(id);
      await loadData();
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Inventario Pro</h2>
          <p className="text-slate-500 font-medium">Control total de stock y márgenes de ganancia.</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsEditing({ category: 'Abarrotes', stock: 0, minStock: 5 })} 
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-primary-500/20 transition-all"
        >
          <Plus size={24} /> NUEVO PRODUCTO
        </motion.button>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden p-0 rounded-[40px]">
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-10 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, categoría o código de barras..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 border-none rounded-2xl outline-none font-medium focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 bg-slate-100/50 px-4 rounded-2xl text-slate-500 font-bold text-sm">
            <Package size={18} /> {filtered.length} Productos
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 sticky top-0 z-10 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
              <tr>
                <th className="p-6">Código / SKU</th>
                <th className="p-6">Información del Producto</th>
                <th className="p-6 text-right">Coste</th>
                <th className="p-6 text-right">P. Venta</th>
                <th className="p-6 text-center">Disponibilidad</th>
                <th className="p-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p, idx) => {
                const margin = (((p.price - p.cost) / p.cost) * 100).toFixed(0);
                const isLowStock = p.stock <= p.minStock;
                return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    key={p.id} 
                    className="hover:bg-primary-50/30 transition-colors group"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                          <Barcode size={16} />
                        </div>
                        <span className="font-mono text-sm font-bold text-slate-500">{p.barcode}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="font-black text-slate-800 text-lg group-hover:text-primary-600 transition-colors">{p.name}</p>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">{p.category}</span>
                    </td>
                    <td className="p-6 text-right text-slate-500 font-bold">{formatCurrency(p.cost)}</td>
                    <td className="p-6 text-right">
                      <div className="font-black text-slate-800 text-lg">{formatCurrency(p.price)}</div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-600 font-black uppercase mt-1">
                        <TrendingUp size={10} /> {margin}% Margen
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center justify-center min-w-[3.5rem] px-4 py-1.5 rounded-full font-black text-sm shadow-sm ${
                          isLowStock 
                            ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' 
                            : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                        }`}>
                          {p.stock}
                        </span>
                        {isLowStock && <span className="text-[9px] font-bold text-rose-500 uppercase">Reabastecer</span>}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setIsEditing(p)} className="p-3 text-slate-400 hover:text-primary-600 hover:bg-primary-100 rounded-xl transition-all">
                          <Edit size={20} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-20 text-center text-slate-300">
               <Package size={80} className="mx-auto opacity-10 mb-6" />
               <p className="text-xl font-bold">No se encontraron productos</p>
            </div>
          )}
        </div>
      </GlassCard>

      <AnimatePresence>
        {isEditing && (
          <ProductFormModal 
            product={isEditing} 
            onClose={() => setIsEditing(null)} 
            onSave={handleSave} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductFormModal({ product, onClose, onSave }: any) {
  const [formData, setFormData] = useState(product);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      ...formData,
      cost: Number(formData.cost),
      price: Number(formData.price),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock)
    });
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-8 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-800">{product.id ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <p className="text-sm text-slate-400 font-medium">Completa la información técnica del artículo.</p>
          </div>
          <button onClick={onClose} className="p-3 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
            <X size={24}/>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <FormField label="Código de Barras" icon={<Barcode size={18}/>}>
              <input required type="text" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} className="form-input" />
            </FormField>
            <FormField label="Categoría" icon={<Package size={18}/>}>
              <input required type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="form-input" />
            </FormField>
            <div className="col-span-2">
              <FormField label="Nombre Comercial" full>
                <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="form-input font-bold text-xl" />
              </FormField>
            </div>
            <FormField label="Costo de Adquisición" icon={<DollarSign size={18}/>}>
              <input required type="number" step="0.01" value={formData.cost || ''} onChange={e => setFormData({...formData, cost: e.target.value})} className="form-input" />
            </FormField>
            <FormField label="Precio de Venta" icon={<TrendingUp size={18}/>}>
              <input required type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})} className="form-input font-black text-primary-600" />
            </FormField>
            <FormField label="Stock Actual">
              <input required type="number" value={formData.stock || 0} onChange={e => setFormData({...formData, stock: e.target.value})} className="form-input" />
            </FormField>
            <FormField label="Alerta Stock Mínimo">
              <input required type="number" value={formData.minStock || 0} onChange={e => setFormData({...formData, minStock: e.target.value})} className="form-input" />
            </FormField>
          </div>

          <div className="pt-8 border-t border-slate-100 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-8 py-4 font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all">CANCELAR</button>
            <button type="submit" disabled={loading} className="px-8 py-4 font-black text-white bg-primary-600 hover:bg-primary-500 rounded-2xl flex items-center gap-3 shadow-xl shadow-primary-500/20 transition-all active:scale-95">
              <Save size={24} /> {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function FormField({ label, icon, children, full = false }: any) {
  return (
    <div className={full ? "w-full" : ""}>
      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}
