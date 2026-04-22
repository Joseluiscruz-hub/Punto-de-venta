import { useState, useEffect } from 'react';
import { Tags, Search, TrendingUp, TrendingDown, Percent, Save, RefreshCcw, DollarSign, ArrowUpRight } from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import type { Product } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';
import SurfaceCard from '../../components/common/GlassCard';

export default function PricesView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    BackendAPI.getProducts().then(setProducts);
  }, []);

  const handlePriceChange = (id: string, newPrice: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, price: newPrice } : p));
  };

  const handleMarginChange = (id: string, newMarginPercent: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const newPrice = p.cost * (1 + newMarginPercent / 100);
        return { ...p, price: Math.ceil(newPrice * 2) / 2 }; // Redondeo a .50
      }
      return p;
    }));
  };

  const savePrices = async () => {
    setIsSaving(true);
    try {
      await BackendAPI.saveProducts(products);
      alert('Precios actualizados con éxito');
    } catch (error) {
      alert('Error al guardar precios');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-bg overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
              <Tags size={24} className="text-bg" />
            </div>
            <h1 className="text-3xl font-black text-text-strong tracking-tight uppercase">Control de Precios</h1>
          </div>
          <p className="text-text-secondary font-medium">Gestión de márgenes de utilidad y precios de venta</p>
        </div>

        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por SKU o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise text-text-strong"
            />
          </div>
          <button 
            onClick={savePrices}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 bg-primary text-bg font-black rounded-xl hover:bg-primary-dark transition-enterprise uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
          >
            {isSaving ? <RefreshCcw className="animate-spin" size={18} /> : <Save size={18} />}
            Aplicar Cambios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SurfaceCard className="p-6">
           <div className="flex items-center gap-3 text-text-secondary mb-4">
              <Percent size={18} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest">Utilidad Promedio</span>
           </div>
           <p className="text-3xl font-black text-text-strong tracking-tighter">28.4%</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
           <div className="flex items-center gap-3 text-text-secondary mb-4">
              <TrendingUp size={18} className="text-success" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mayor Margen</span>
           </div>
           <p className="text-3xl font-black text-success tracking-tighter">45.0%</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
           <div className="flex items-center gap-3 text-text-secondary mb-4">
              <TrendingDown size={18} className="text-error" />
              <span className="text-[10px] font-black uppercase tracking-widest">Menor Margen</span>
           </div>
           <p className="text-3xl font-black text-error tracking-tighter">8.5%</p>
        </SurfaceCard>
      </div>

      <div className="flex-1 bg-surface-1 border border-border-subtle rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1/90 backdrop-blur-md z-10 border-b border-border-subtle">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest">Producto</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Costo Base</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Margen %</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Precio Sugerido</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Utilidad Bruta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredProducts.map(product => {
                const margin = ((product.price - product.cost) / (product.cost || 1)) * 100;
                const profit = product.price - product.cost;
                
                return (
                  <tr key={product.id} className="hover:bg-surface-2/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div>
                        <p className="font-black text-text-strong text-sm leading-tight mb-1">{product.name}</p>
                        <p className="text-[10px] font-bold text-text-secondary font-mono">{product.barcode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-text-secondary">
                      {formatCurrency(product.cost)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end items-center gap-3">
                        <input 
                          type="number"
                          value={Math.round(margin)}
                          onChange={(e) => handleMarginChange(product.id, Number(e.target.value))}
                          className="w-20 h-10 bg-surface-2 border border-border-subtle rounded-xl text-right px-3 text-xs font-black text-primary outline-none focus:border-primary"
                        />
                        <span className="text-[10px] font-black text-text-secondary">%</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end items-center gap-3">
                        <DollarSign size={14} className="text-text-secondary" />
                        <input 
                          type="number"
                          value={product.price}
                          onChange={(e) => handlePriceChange(product.id, Number(e.target.value))}
                          className="w-24 h-10 bg-bg border border-border-subtle rounded-xl text-right px-3 text-sm font-black text-text-strong outline-none focus:border-primary"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 text-success font-black">
                        <ArrowUpRight size={14} />
                        {formatCurrency(profit)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
