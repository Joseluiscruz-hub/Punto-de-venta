import { useState, useEffect } from 'react';
import { History, Search, Calendar, User, CreditCard, Banknote, FileText, ChevronRight, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import type { Sale } from '../../models/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import GlassCard from '../../components/common/GlassCard';

export default function SalesView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    BackendAPI.getSales().then(data => {
      setSales(data);
    });
  }, []);

  const filteredSales = sales.filter(s => 
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-slate-50 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-500/30">
              <History size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Auditoría y Arqueo</h1>
          </div>
          <p className="text-slate-500 font-medium">Historial de ventas de <span className="text-emerald-600 font-black">EL TRIUNFO</span></p>
        </div>

        <div className="w-full md:w-96 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por folio o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl shadow-sm outline-none transition-all font-bold"
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Folio</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atendió</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Método</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => (
                <tr key={sale.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 font-mono tracking-tighter">#{sale.id}</span>
                      {sale.isOfflineSync && (
                        <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1 mt-1">
                          <QrCode size={10} /> Sincronizado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(sale.date)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                      <User size={14} className="text-slate-400" />
                      Cajero #{sale.userId}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        sale.paymentMethod === 'CASH' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : sale.paymentMethod === 'CARD'
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {sale.paymentMethod === 'CASH' ? <Banknote size={14} /> : sale.paymentMethod === 'CARD' ? <CreditCard size={14} /> : <QrCode size={14} />}
                        {sale.paymentMethod}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-black text-slate-800">{formatCurrency(sale.total)}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end">
                      <button className="p-2 text-slate-300 group-hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                        <FileText size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredSales.length === 0 && (
            <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
              <History size={64} strokeWidth={1} className="opacity-20" />
              <p className="font-black text-sm uppercase tracking-widest opacity-50">No hay registros de venta</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
