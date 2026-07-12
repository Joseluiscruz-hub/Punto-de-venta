import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { StockMovementView } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { normalizeText } from '../utils/helpers';

export function MovementsView() {
  const { reqContext } = useAuth();
  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    BackendAPI.getStockMovements(reqContext).then(setMovements);
  }, [reqContext]);

  const filtered = movements.filter(
    (m) =>
      normalizeText(m.productName).includes(normalizeText(search)) ||
      normalizeText(m.reason).includes(normalizeText(search)) ||
      normalizeText(m.userName).includes(normalizeText(search)),
  );

  return (
    <div className="view-shell p-4 sm:p-6 lg:p-8 h-full min-h-0 flex flex-col text-slate-900 dark:text-[#E2E8F0] gap-6 transition-colors">
      <div>
        <p className="section-kicker">Kardex digital</p>
        <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white">
          Auditoría de Inventarios
        </h2>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Traza cada movimiento físico de mercancía en el sistema.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex-1 overflow-hidden flex flex-col transition-colors shadow-sm min-h-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por producto, motivo o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-premium w-full pl-10 pr-4 py-3 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-colors bg-white dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary-light shadow-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-[10px] sm:text-[11px] whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 uppercase font-black tracking-[0.1em] text-slate-500 sticky top-0 transition-colors z-10">
              <tr>
                <th className="px-4 sm:px-6 py-4">FECHA</th>
                <th className="px-4 sm:px-6 py-4">PRODUCTO</th>
                <th className="px-4 sm:px-6 py-4">OPERACIÓN</th>
                <th className="px-4 sm:px-6 py-4 text-right">CANTIDAD</th>
                <th className="px-4 sm:px-6 py-4">MOTIVO</th>
                <th className="px-4 sm:px-6 py-4">USUARIO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-primary/5 transition-colors text-slate-700 dark:text-slate-300"
                >
                  <td className="px-4 sm:px-6 py-4 font-semibold">{new Date(m.date).toLocaleString()}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold text-slate-900 dark:text-white uppercase">
                    {m.productName}
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <span
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase ${m.quantity > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-black tabular-nums ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </td>
                  <td className="px-4 sm:px-6 py-4 italic text-slate-500">{m.reason}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold">{m.userName}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-20 text-center text-slate-400 font-medium italic"
                  >
                    No se encontraron movimientos registrados
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
