import React, { useState, useEffect } from 'react';
import { History, Search, Calendar, User, CreditCard, Banknote, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import { Sale } from '../../models/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import GlassCard from '../../components/common/GlassCard';

export default function SalesView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    BackendAPI.getSales().then(data => {
      setSales(data);
      setLoading(false);
    });
  }, []);

  const filtered = sales.filter(s => 
    s.id.toLowerCase().includes(search.toLowerCase()) || 
    s.paymentMethod.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 bg-slate-50 overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Auditoría de Ventas</h2>
          <p className="text-slate-500 font-medium">Historial detallado de todas las transacciones procesadas.</p>
        </div>
        <div className="flex gap-4">
           <button className="bg-white text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all">
             <Calendar size={20} /> FILTRAR FECHA
           </button>
           <button className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl hover:bg-slate-800 transition-all">
             <FileText size={20} /> EXPORTAR REPORTE
           </button>
        </div>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden p-0 rounded-[40px]">
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por ID de transacción o método de pago..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 border-none rounded-2xl outline-none font-medium focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="divide-y divide-slate-100">
            {filtered.map((sale, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={sale.id} 
                className="p-6 flex items-center gap-6 hover:bg-primary-50/30 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all">
                  {sale.paymentMethod === 'CASH' ? <Banknote size={28} /> : <CreditCard size={28} />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-xs font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded">#{sale.id}</span>
                    <span className="text-slate-400 text-xs font-bold uppercase flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(sale.datetime)}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight">
                    {sale.items.length} productos vendidos
                  </h4>
                  <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                    <User size={14} /> ID Cajero: {sale.cashierId}
                  </p>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(sale.total)}</div>
                  <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                    sale.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    PAGADO CON {sale.paymentMethod === 'CASH' ? 'EFECTIVO' : 'TARJETA'}
                  </div>
                </div>

                <div className="text-slate-300 group-hover:text-primary-500 transition-colors pl-4">
                  <ChevronRight size={24} />
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="p-20 text-center text-slate-300">
               <History size={80} className="mx-auto opacity-10 mb-6" />
               <p className="text-xl font-bold">No hay transacciones registradas</p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
