import { useState, type FormEvent } from 'react';
import { Banknote } from 'lucide-react';
import type { Shift } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../utils/helpers';

export function OpenShiftModal({ onOpen }: { onOpen: (shift: Shift) => void }) {
  const { reqContext } = useAuth();
  const [initialCash, setInitialCash] = useState('200');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const shift = await BackendAPI.openShift(reqContext, parseFloat(initialCash) || 0);
      onOpen(shift);
    } catch (error) {
      alert(errorMessage(error, 'No se pudo abrir el turno'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] w-full max-w-sm shadow-2xl border border-white/20 dark:border-slate-800"
      >
        <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
          <Banknote size={32} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
          Abrir Turno
        </h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">
          Preparacion de Punto de Venta
        </p>

        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
              Fondo de Caja (Efectivo Inicial)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-primary-light">
                $
              </span>
              <input
                required
                type="number"
                value={initialCash}
                onChange={(event) => setInitialCash(event.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 sm:p-5 pl-10 rounded-[20px] text-2xl sm:text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-primary-light/10 transition-all shadow-sm"
                autoFocus
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 sm:py-5 bg-primary hover:bg-primary-light text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Inicializando...' : 'Comenzar Operaciones'}
        </button>

        <div className="mt-6 text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            Protocolo de Seguridad Financiera v2.0
          </p>
        </div>
      </form>
    </div>
  );
}
