import React, { useState, useEffect } from 'react';
import { Landmark, Banknote } from 'lucide-react';
import { Shift } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage, formatCurrency } from '../utils/helpers';

export function CorteCajaView({ onShiftClosed }: { onShiftClosed: () => void }) {
  const { reqContext } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [countedCash, setCountedCash] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([BackendAPI.getActiveShift(reqContext), BackendAPI.getShifts(reqContext)]).then(
      ([current, history]) => {
        if (!active) return;
        setActiveShift(current);
        setShifts(history);
      },
    );
    return () => {
      active = false;
    };
  }, [reqContext]);

  const handleClose = async () => {
    if (!activeShift) return;
    setLoading(true);
    try {
      await BackendAPI.closeShift(reqContext, parseFloat(countedCash) || 0);
      onShiftClosed();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo cerrar el turno'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-shell p-4 lg:p-8 h-full overflow-y-auto text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      <div>
        <p className="section-kicker">Caja segura</p>
        <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">
          Control de Efectivo y Turnos
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Shift Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl xl:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary-light">
              Turno Actual en Operación
            </h3>
            <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">
              Activo
            </span>
          </div>

          {activeShift ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Fondo Inicial</p>
                <p className="text-2xl font-mono font-bold">
                  {formatCurrency(activeShift.initialCash)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Ventas Efectivo (+)
                </p>
                <p className="text-2xl font-mono font-bold text-emerald-600">
                  +{formatCurrency(activeShift.salesCash)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Ventas Tarjeta (Ref)
                </p>
                <p className="text-2xl font-mono font-bold text-blue-500">
                  {formatCurrency(activeShift.salesCard)}
                </p>
              </div>

              <div className="md:col-span-3 pt-6 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Efectivo Esperado en Caja
                  </p>
                  <p className="text-4xl font-black tracking-tighter text-primary-light">
                    {formatCurrency(activeShift.expectedCash)}
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="Dinero físico contado..."
                      className="input-premium w-full md:w-64 pl-8 pr-4 py-3 font-bold text-lg outline-none bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary-light shadow-sm"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading || !countedCash}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Procesando...' : 'Cerrar Turno y Arqueo'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center opacity-50">Cargando datos del turno...</div>
          )}
        </div>

        {/* Quick Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Landmark className="text-primary-light" />
              <h4 className="font-bold text-xs uppercase">Resumen de Seguridad</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              El cierre de turno es una operación crítica. Asegúrate de contar todas las
              denominaciones antes de ingresar el monto final. Las diferencias mayores a $50.00
              dispararán una alerta administrativa.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-xs uppercase bg-slate-50/50 dark:bg-slate-800/20">
          Historial de Cortes de Caja
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 uppercase font-black tracking-[0.1em] text-slate-400 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">FECHA CIERRE</th>
                <th className="px-6 py-4 text-right">ESPERADO</th>
                <th className="px-6 py-4 text-right">CONTADO</th>
                <th className="px-6 py-4 text-right">DIFERENCIA</th>
                <th className="px-6 py-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {s.endTime ? new Date(s.endTime).toLocaleString() : 'En curso'}
                    </p>
                    <p className="text-[9px] text-slate-400 font-mono">{s.id}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-bold tabular-nums">
                    {formatCurrency(s.expectedCash)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold tabular-nums">
                    {formatCurrency(s.actualCash || 0)}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-black tabular-nums ${(s.difference || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                  >
                    {formatCurrency(s.difference || 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-[6px] text-[9px] font-black uppercase ${s.status === 'CLOSED' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}
                    >
                      {s.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                    </span>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                    No hay historial de turnos
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

export function OpenShiftModal({ onOpen }: { onOpen: (s: Shift) => void }) {
  const { reqContext } = useAuth();
  const [initialCash, setInitialCash] = useState('200');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        className="bg-white dark:bg-slate-900 p-8 rounded-[40px] w-full max-w-sm shadow-2xl border border-white/20 dark:border-slate-800"
      >
        <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
          <Banknote size={32} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
          Abrir Turno
        </h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">
          Preparación de Punto de Venta
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
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-5 pl-10 rounded-[20px] text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-primary-light/10 transition-all shadow-sm"
                autoFocus
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-5 bg-primary hover:bg-primary-light text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
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
