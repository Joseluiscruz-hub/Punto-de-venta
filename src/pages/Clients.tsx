import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Mail, Phone, Edit, Trash2, X } from 'lucide-react';
import { Client } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage, formatCurrency } from '../utils/helpers';

export function ClientsView() {
  const { reqContext } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClients = useCallback(async () => {
    const data = await BackendAPI.getClients(reqContext);
    setClients(data);
  }, [reqContext]);

  useEffect(() => {
    let active = true;
    BackendAPI.getClients(reqContext).then((data) => {
      if (active) setClients(data);
    });
    return () => {
      active = false;
    };
  }, [reqContext]);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.taxId?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search),
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await BackendAPI.saveClient(reqContext, editingClient!);
      setEditingClient(null);
      loadClients();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo guardar el cliente'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    try {
      await BackendAPI.deleteClient(reqContext, id);
      loadClients();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo eliminar el cliente'));
    }
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full overflow-y-auto flex flex-col gap-6">
      {editingClient && (
        <ClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSave={handleSave}
          loading={loading}
          onChange={(updates) => setEditingClient({ ...editingClient, ...updates })}
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="section-kicker">CRM compacto</p>
          <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-primary-light" /> Directorio de Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">
            Gestión de cartera y lealtad
          </p>
        </div>
        <button
          onClick={() => setEditingClient({ name: '', email: '', phone: '', taxId: '' })}
          className="btn-primary px-6 py-3 text-xs flex items-center gap-2"
        >
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC o teléfono..."
            className="input-premium w-full pl-10 pr-4 py-3 font-bold text-sm outline-none transition-all bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary-light"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[10px] sm:text-[11px] whitespace-nowrap min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-4 sm:px-6 py-4">CLIENTE</th>
                <th className="px-4 sm:px-6 py-4">CONTACTO</th>
                <th className="px-4 sm:px-6 py-4">RFC / TAX ID</th>
                <th className="px-4 sm:px-6 py-4 text-center">PUNTOS</th>
                <th className="px-4 sm:px-6 py-4 text-right">SALDO A FAVOR</th>
                <th className="px-4 sm:px-6 py-4 text-right">TOTAL COMPRADO</th>
                <th className="px-4 sm:px-6 py-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-primary/5 transition-colors text-slate-700 dark:text-slate-300"
                >
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary-light">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white uppercase">
                          {c.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">ID: {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="space-y-1">
                      {c.email && (
                        <div className="flex items-center gap-1">
                          <Mail size={10} className="text-slate-400" /> {c.email}
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={10} className="text-slate-400" /> {c.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 font-mono font-bold text-slate-500">
                    {c.taxId || 'N/A'}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg font-black">
                      {c.points} PTS
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right font-black text-emerald-600 tabular-nums">
                    {formatCurrency(c.storeCredit)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(c.totalSpent)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setEditingClient(c)}
                        className="p-2 text-slate-400 hover:text-primary-light hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-2 text-slate-400 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-20 text-center text-slate-400 font-medium italic"
                  >
                    No se encontraron clientes registrados
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

function ClientModal({
  client,
  onClose,
  onSave,
  loading,
  onChange,
}: {
  client: Partial<Client>;
  onClose: () => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  onChange: (updates: Partial<Client>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <form
        onSubmit={onSave}
        className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
            {client.id ? 'Editar' : 'Nuevo'} Cliente
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Nombre Completo
            </label>
            <input
              required
              value={client.name || ''}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-light transition-all"
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                Teléfono
              </label>
              <input
                value={client.phone || ''}
                onChange={(e) => onChange({ phone: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-light transition-all"
                placeholder="5512345678"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                RFC / ID Fiscal
              </label>
              <input
                value={client.taxId || ''}
                onChange={(e) => onChange({ taxId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-light transition-all"
                placeholder="XAXX010101000"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={client.email || ''}
              onChange={(e) => onChange({ email: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary-light transition-all"
              placeholder="cliente@ejemplo.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 sm:mt-8 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Registrar Cliente'}
        </button>
      </form>
    </div>
  );
}
