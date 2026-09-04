import { useCallback, useState, useEffect } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Landmark, Printer } from 'lucide-react';
import type { CashMovement, CashMovementType, Shift } from '../models/types';
import { BackendAPI } from '../data/backend';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CashCutReport } from '../components/CashCutReport';
import { createOfflineId, errorMessage, formatCurrency } from '../utils/helpers';

export function CorteCajaView({ onShiftClosed }: { onShiftClosed: () => void }) {
  const { reqContext, store, user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [countedCash, setCountedCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [movementType, setMovementType] = useState<CashMovementType>('CASH_OUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementLoading, setMovementLoading] = useState(false);
  const [confirmDifference, setConfirmDifference] = useState(false);
  const [printShift, setPrintShift] = useState<Shift | null>(null);
  const [printMovements, setPrintMovements] = useState<CashMovement[]>([]);
  const [printLoading, setPrintLoading] = useState(false);

  const loadCashData = useCallback(async () => {
    const [current, history] = await Promise.all([
      BackendAPI.getActiveShift(reqContext),
      BackendAPI.getShifts(reqContext),
    ]);
    const movements = current ? await BackendAPI.getCashMovements(reqContext, current.id) : [];
    setActiveShift(current);
    setShifts(history);
    setCashMovements(movements);
  }, [reqContext]);

  useEffect(() => {
    let active = true;
    const initialLoad = window.setTimeout(() => {
      void loadCashData().catch((error) => {
        if (active) alert(errorMessage(error, 'No se pudo cargar la información de caja'));
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(initialLoad);
    };
  }, [loadCashData]);

  const closeShift = async () => {
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

  const handleClose = () => {
    if (!activeShift) return;
    const counted = Number(countedCash);
    if (!Number.isFinite(counted) || counted < 0) {
      alert('Ingresa un efectivo contado válido');
      return;
    }
    if (Math.abs(counted - activeShift.expectedCash) > activeShift.differenceThreshold) {
      setConfirmDifference(true);
      return;
    }
    void closeShift();
  };

  const handleCashMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeShift) return;
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Ingresa un monto mayor a cero');
      return;
    }
    if (movementReason.trim().length < 3) {
      alert('Describe el motivo del movimiento');
      return;
    }
    setMovementLoading(true);
    try {
      await BackendAPI.addCashMovement(reqContext, activeShift.id, {
        externalId: createOfflineId(),
        type: movementType,
        amount,
        reason: movementReason,
      });
      setMovementAmount('');
      setMovementReason('');
      await loadCashData();
    } catch (error) {
      alert(errorMessage(error, 'No se pudo registrar el movimiento de efectivo'));
    } finally {
      setMovementLoading(false);
    }
  };

  const openPrintReport = useCallback(
    async (shift: Shift) => {
      setPrintLoading(true);
      try {
        const movements = await BackendAPI.getCashMovements(reqContext, shift.id);
        setPrintShift(shift);
        setPrintMovements(movements);
        window.setTimeout(() => {
          document.body.classList.add('printing-cash-cut');
          try {
            window.print();
          } finally {
            document.body.classList.remove('printing-cash-cut');
            setPrintShift(null);
            setPrintMovements([]);
          }
        }, 0);
      } catch (error) {
        alert(errorMessage(error, 'No se pudo preparar el reporte de corte de caja'));
      } finally {
        setPrintLoading(false);
      }
    },
    [reqContext],
  );

  return (
    <div className="view-shell p-4 sm:p-6 lg:p-8 h-full overflow-y-auto text-slate-900 dark:text-[#E2E8F0] flex flex-col gap-6 transition-colors">
      {confirmDifference && activeShift && (
        <ConfirmDialog
          title="Diferencia de caja"
          message={`La diferencia es de ${formatCurrency(
            Number(countedCash) - activeShift.expectedCash,
          )}, mayor al umbral de ${formatCurrency(activeShift.differenceThreshold)}. ¿Deseas cerrar y dejarla auditada?`}
          onCancel={() => setConfirmDifference(false)}
          onConfirm={() => {
            setConfirmDifference(false);
            void closeShift();
          }}
          isProcessing={loading}
        />
      )}
      <div>
        <p className="section-kicker">Caja segura</p>
        <h2 className="text-3xl font-black tracking-[-0.06em] text-slate-900 dark:text-white flex items-center gap-2">
          Control de Efectivo y Turnos
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl xl:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary-light">Turno Actual en Operación</h3>
            <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">Activo</span>
          </div>

          {activeShift ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Fondo Inicial</p>
                <p className="text-2xl font-mono font-bold">{formatCurrency(activeShift.initialCash)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas Efectivo (+)</p>
                <p className="text-2xl font-mono font-bold text-emerald-600">+{formatCurrency(activeShift.salesCash)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas Tarjeta (Ref)</p>
                <p className="text-2xl font-mono font-bold text-blue-500">{formatCurrency(activeShift.salesCard)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Reembolsos Efectivo (-)</p>
                <p className="text-2xl font-mono font-bold text-rose-600">-{formatCurrency(activeShift.refundsCash)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Entradas de Caja (+)</p>
                <p className="text-2xl font-mono font-bold text-emerald-600">+{formatCurrency(activeShift.cashIn)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Retiros de Caja (-)</p>
                <p className="text-2xl font-mono font-bold text-amber-600">-{formatCurrency(activeShift.cashOut)}</p>
              </div>
              <div className="md:col-span-3 pt-6 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Efectivo Esperado en Caja</p>
                  <p className="text-4xl font-black tracking-tighter text-primary-light">{formatCurrency(activeShift.expectedCash)}</p>
                </div>
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" placeholder="Dinero físico contado..." className="input-premium w-full md:w-64 pl-8 pr-4 py-3 font-bold text-lg outline-none bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary-light shadow-sm" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                  </div>
                  <button type="button" onClick={() => void openPrintReport(activeShift)} disabled={loading || printLoading} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 flex items-center justify-center gap-2">
                    <Printer size={15} />
                    Imprimir corte preliminar
                  </button>
                  <button onClick={handleClose} disabled={loading || !countedCash} className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50">
                    {loading ? 'Procesando...' : 'Cerrar Turno y Arqueo'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center opacity-50">Cargando datos del turno...</div>
          )}
        </div>

        <div className="space-y-6">
          <form onSubmit={handleCashMovement} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <h4 className="mb-4 text-xs font-bold uppercase">Movimiento de efectivo</h4>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMovementType('CASH_IN')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${movementType === 'CASH_IN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <ArrowDownCircle size={16} /> Entrada
              </button>
              <button type="button" onClick={() => setMovementType('CASH_OUT')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${movementType === 'CASH_OUT' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <ArrowUpCircle size={16} /> Retiro
              </button>
            </div>
            <input required aria-label="Monto del movimiento" type="number" min="0.01" step="0.01" placeholder="Monto" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} className="input-premium mb-3 w-full p-3 text-sm font-bold" />
            <input required aria-label="Motivo del movimiento" placeholder="Motivo: depósito, cambio, pago..." value={movementReason} onChange={(event) => setMovementReason(event.target.value)} className="input-premium mb-3 w-full p-3 text-sm" />
            <button type="submit" disabled={movementLoading || !activeShift} className="btn-primary w-full py-3 text-xs disabled:opacity-50">
              {movementLoading ? 'Registrando...' : 'Registrar movimiento'}
            </button>
            {cashMovements.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {cashMovements.slice(0, 4).map((movement) => (
                  <div key={movement.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{movement.reason}</p>
                      <p className="text-[10px] text-slate-400">{new Date(movement.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <strong className={movement.type === 'CASH_IN' ? 'text-emerald-600' : 'text-amber-600'}>
                      {movement.type === 'CASH_IN' ? '+' : '-'}
                      {formatCurrency(movement.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </form>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Landmark className="text-primary-light" />
              <h4 className="font-bold text-xs uppercase">Resumen de Seguridad</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              El cierre de turno es una operación crítica. Asegúrate de contar todas las denominaciones antes de ingresar el monto final. Las diferencias mayores a{' '}
              {formatCurrency(activeShift?.differenceThreshold ?? 50)} quedarán confirmadas y auditadas.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-xs uppercase bg-slate-50/50 dark:bg-slate-800/20">Historial de Cortes de Caja</div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[10px] sm:text-[11px] whitespace-nowrap min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 uppercase font-black tracking-[0.1em] text-slate-400 sticky top-0 z-10">
              <tr>
                <th className="px-4 sm:px-6 py-4">FECHA CIERRE</th>
                <th className="px-4 sm:px-6 py-4 text-right">ESPERADO</th>
                <th className="px-4 sm:px-6 py-4 text-right">REEMBOLSOS</th>
                <th className="px-4 sm:px-6 py-4 text-right">ENTRADAS</th>
                <th className="px-4 sm:px-6 py-4 text-right">RETIROS</th>
                <th className="px-4 sm:px-6 py-4 text-right">CONTADO</th>
                <th className="px-4 sm:px-6 py-4 text-right">DIFERENCIA</th>
                <th className="px-4 sm:px-6 py-4">STATUS</th>
                <th className="px-4 sm:px-6 py-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-4 sm:px-6 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{s.endTime ? new Date(s.endTime).toLocaleString() : 'En curso'}</p>
                    <p className="text-[9px] text-slate-400 font-mono">{s.id}</p>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold tabular-nums">{formatCurrency(s.expectedCash)}</td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-rose-600 tabular-nums">{formatCurrency(s.refundsCash)}</td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-emerald-600 tabular-nums">{formatCurrency(s.cashIn)}</td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold text-amber-600 tabular-nums">{formatCurrency(s.cashOut)}</td>
                  <td className="px-4 sm:px-6 py-4 text-right font-bold tabular-nums">{formatCurrency(s.actualCash || 0)}</td>
                  <td className={`px-4 sm:px-6 py-4 text-right font-black tabular-nums ${(s.difference || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(s.difference || 0)}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className={`px-2 py-1 rounded-[6px] text-[9px] font-black uppercase ${s.status === 'CLOSED' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                      {s.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <button type="button" onClick={() => void openPrintReport(s)} className="table-action-button" aria-label={`Imprimir corte ${s.id.slice(-8).toUpperCase()}`} title="Imprimir corte" disabled={printLoading}>
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400 italic">No hay historial de turnos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printShift && (
        <div className="cash-cut-print-host" aria-hidden="true">
          <CashCutReport shift={printShift} movements={printMovements} storeName={store?.name ?? 'Sucursal'} cashierName={user?.name} />
        </div>
      )}
    </div>
  );
}
