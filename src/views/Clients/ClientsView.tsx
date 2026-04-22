import { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Mail, Phone, MapPin, ChevronRight, UserCheck, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendAPI } from '../../api/backend';
import type { Customer } from '../../models/types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import SurfaceCard from '../../components/common/GlassCard';

export default function ClientsView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    BackendAPI.getCustomers().then(setCustomers);
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-bg overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
              <Users size={24} className="text-bg" />
            </div>
            <h1 className="text-3xl font-black text-text-strong tracking-tight uppercase">Directorio de Clientes</h1>
          </div>
          <p className="text-text-secondary font-medium">Gestión de lealtad y perfiles de compradores</p>
        </div>

        <div className="flex gap-3">
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise text-text-strong"
            />
          </div>
          <button className="flex items-center gap-2 px-6 bg-primary text-bg font-black rounded-xl hover:bg-primary-dark transition-enterprise uppercase tracking-widest text-[10px]">
            <UserPlus size={18} /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Lista de Clientes */}
        <div className="lg:col-span-2 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <AnimatePresence>
            {filteredCustomers.map(customer => (
              <motion.div
                key={customer.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-surface-1 border border-border-subtle rounded-[24px] p-6 hover:border-primary/40 transition-enterprise relative overflow-hidden"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center text-primary text-2xl font-black">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-strong mb-1">{customer.name}</h3>
                      <div className="flex flex-wrap gap-4 text-[11px] font-bold text-text-secondary">
                        <span className="flex items-center gap-1"><Mail size={12} className="text-primary" /> {customer.email || 'N/A'}</span>
                        <span className="flex items-center gap-1"><Phone size={12} className="text-primary" /> {customer.phone || 'N/A'}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} className="text-primary" /> {customer.address || 'Sin dirección'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Consumo Total</p>
                    <p className="text-xl font-black text-primary tracking-tighter">{formatCurrency(customer.totalSpent)}</p>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-surface-2 px-3 py-1.5 rounded-lg border border-border-subtle">
                      <Star size={12} className="text-alert" fill="currentColor" />
                      <span className="text-[10px] font-black text-text-strong uppercase tracking-wider">Cliente Frecuente</span>
                    </div>
                    <span className="text-[10px] font-bold text-text-secondary">Última compra: {formatDate(customer.lastVisit)}</span>
                  </div>
                  <button className="text-[10px] font-black text-text-secondary hover:text-primary uppercase tracking-widest flex items-center gap-1">
                    Ver Expediente <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Panel de Resumen / Acción */}
        <div className="space-y-6">
          <SurfaceCard className="p-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary mb-6">Métricas de Cartera</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Ticket Promedio por Cliente</p>
                <p className="text-3xl font-black text-text-strong tracking-tighter">
                  {formatCurrency(customers.reduce((sum, c) => sum + c.totalSpent, 0) / (customers.length || 1))}
                </p>
              </div>
              <div className="pt-6 border-t border-border-subtle">
                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Nuevos este mes</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-black text-success tracking-tighter">+8</p>
                  <span className="text-[10px] font-bold text-text-secondary">En comparación a marzo</span>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard level={2} className="p-8 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3 mb-6">
              <UserCheck size={20} className="text-primary" />
              <h4 className="text-xs font-black uppercase tracking-widest text-primary">Próximos Cumpleaños</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-text-strong">Ricardo Salinas</span>
                <span className="text-primary">Mañana</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold opacity-50">
                <span className="text-text-strong">Elena Garro</span>
                <span className="text-text-secondary">25 Abr</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
