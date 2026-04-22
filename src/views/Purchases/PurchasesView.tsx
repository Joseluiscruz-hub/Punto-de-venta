import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, FileText, Truck, Calendar, PackagePlus, Layers } from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import type { Purchase, Product } from '../../models/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import SurfaceCard from '../../components/common/GlassCard';

export default function PurchasesView() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    BackendAPI.getPurchases().then(setPurchases);
    BackendAPI.getProducts().then(setProducts);
  }, []);

  const filteredPurchases = purchases.filter(p => 
    p.id.toLowerCase().includes(search.toLowerCase()) || 
    p.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-bg overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
              <ShoppingBag size={24} className="text-bg" />
            </div>
            <h1 className="text-3xl font-black text-text-strong tracking-tight uppercase">Entrada de Mercancía</h1>
          </div>
          <p className="text-text-secondary font-medium">Registro de compras a proveedores y control de costos</p>
        </div>

        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder="Folio o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise text-text-strong"
            />
          </div>
          <button className="flex items-center gap-2 px-6 bg-primary text-bg font-black rounded-xl hover:bg-primary-dark transition-enterprise uppercase tracking-widest text-[10px]">
            <Plus size={18} /> Nueva Compra
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SurfaceCard className="p-6 border-l-4 border-l-primary">
          <div className="flex items-center gap-4">
             <div className="bg-surface-2 p-3 rounded-xl text-text-secondary"><Truck size={20} /></div>
             <div>
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Inversión Mensual</p>
                <p className="text-xl font-black text-text-strong">{formatCurrency(45800)}</p>
             </div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-6 border-l-4 border-l-alert">
          <div className="flex items-center gap-4">
             <div className="bg-surface-2 p-3 rounded-xl text-text-secondary"><PackagePlus size={20} /></div>
             <div>
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Unidades Recibidas</p>
                <p className="text-xl font-black text-text-strong">1,240</p>
             </div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-6 md:col-span-2">
           <div className="flex items-center gap-3 text-text-secondary">
              <Layers size={20} />
              <p className="text-xs font-bold">Resumen de inventario: <span className="text-primary font-black">{products.length} SKU's gestionados</span></p>
           </div>
        </SurfaceCard>
      </div>

      <div className="flex-1 bg-surface-1 border border-border-subtle rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-1/90 backdrop-blur-md z-10 border-b border-border-subtle">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest">Folio / Fecha</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest">Proveedor</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center">Artículos</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Monto Total</th>
                <th className="px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredPurchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-surface-2/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-text-strong font-mono">#{purchase.id}</span>
                      <span className="text-[9px] font-bold text-text-secondary flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(purchase.date)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-black text-text-strong uppercase tracking-tight">{purchase.provider}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="bg-surface-2 px-3 py-1 rounded-full text-[10px] font-black text-text-secondary">
                      {purchase.items.length} Sku's
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-primary">
                    {formatCurrency(purchase.total)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      purchase.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : 'bg-alert/10 text-alert border-alert/20'
                    }`}>
                      {purchase.status === 'COMPLETED' ? 'Recibido' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-text-secondary hover:text-primary transition-all">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPurchases.length === 0 && (
            <div className="p-24 text-center space-y-4 opacity-20">
              <ShoppingBag size={80} strokeWidth={1} className="mx-auto" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No hay registros de compras</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
