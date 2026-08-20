import { useEffect, useMemo, useState } from 'react';
import { Banknote, RotateCcw, WalletCards, X } from 'lucide-react';
import type { RefundMethod, RequestContext, ReturnSaleResult, Sale } from '../../models/types';
import { BackendAPI } from '../../data/backend';
import { errorMessage, formatCurrency } from '../../utils/helpers';
import { Button, SelectInput } from '../ui';

interface ReturnSaleDialogProps {
  sale: Sale;
  context: RequestContext;
  onClose: () => void;
  onCompleted: (result: ReturnSaleResult) => void;
}

export function ReturnSaleDialog({ sale, context, onClose, onCompleted }: ReturnSaleDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const availableItems = useMemo(
    () =>
      (sale.items ?? []).map((item) => ({
        ...item,
        availableQuantity: Math.max(0, item.quantity - item.returnedQuantity),
      })),
    [sale.items],
  );
  const selectedItems = useMemo(
    () =>
      availableItems
        .map((item) => ({
          saleItemId: item.id,
          quantity: quantities[item.id] ?? 0,
          subtotal: item.price * (quantities[item.id] ?? 0),
        }))
        .filter((item) => item.quantity > 0),
    [availableItems, quantities],
  );
  const refundTotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSubmitting, onClose]);

  const updateQuantity = (itemId: string, rawValue: string, max: number) => {
    const parsed = Number.parseInt(rawValue, 10);
    const quantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0;
    setQuantities((current) => ({ ...current, [itemId]: quantity }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedItems.length || reason.trim().length < 3) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await BackendAPI.returnSale(context, sale.id, {
        items: selectedItems.map(({ saleItemId, quantity }) => ({ saleItemId, quantity })),
        refundMethod,
        reason: reason.trim(),
      });
      onCompleted(result);
    } catch (error) {
      setSubmitError(errorMessage(error, 'No se pudo registrar la devolucion.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm animate-fadeIn sm:p-6">
      <form
        className="modal-card flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-sale-title"
        onSubmit={handleSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="summary-card-icon summary-card-icon-danger">
              <RotateCcw size={19} />
            </span>
            <div>
              <p className="section-kicker">Operacion controlada</p>
              <h2
                id="return-sale-title"
                className="text-lg font-black text-slate-950 dark:text-white"
              >
                Devolver venta #{sale.id.slice(-8).toUpperCase()}
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Selecciona solo las unidades recibidas fisicamente.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="top-icon-button"
            aria-label="Cerrar devolucion"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X size={19} />
          </button>
        </header>

        <div className="custom-scrollbar overflow-y-auto p-5 sm:p-6">
          <div className="space-y-3" aria-label="Articulos disponibles para devolucion">
            {availableItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatCurrency(item.price)} por unidad · {item.availableQuantity} disponibles
                    {item.returnedQuantity > 0 ? ` · ${item.returnedQuantity} ya devueltas` : ''}
                  </p>
                </div>
                <label className="flex items-center gap-2 sm:justify-end">
                  <span className="text-xs font-bold text-slate-500">Cantidad</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.availableQuantity}
                    step={1}
                    value={quantities[item.id] ?? 0}
                    onChange={(event) =>
                      updateQuantity(item.id, event.target.value, item.availableQuantity)
                    }
                    disabled={item.availableQuantity === 0 || isSubmitting}
                    className="input-premium h-10 w-20 text-center font-extrabold tabular-nums"
                    aria-label={`Cantidad a devolver de ${item.name}`}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="form-label">Forma de reembolso</span>
              <SelectInput
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value as RefundMethod)}
                disabled={isSubmitting}
                className="mt-2 w-full"
              >
                <option value="CASH">Efectivo</option>
                <option value="STORE_CREDIT" disabled={!sale.clientId}>
                  Saldo a favor del cliente
                </option>
              </SelectInput>
              {!sale.clientId && (
                <span className="mt-2 block text-[0.68rem] font-semibold text-slate-500">
                  El saldo a favor requiere una venta asociada a un cliente.
                </span>
              )}
            </label>
            <label>
              <span className="form-label">Motivo de la devolucion</span>
              <textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setSubmitError(null);
                }}
                minLength={3}
                maxLength={500}
                required
                disabled={isSubmitting}
                placeholder="Ej. Producto dañado o compra incorrecta"
                className="input-premium mt-2 min-h-24 w-full resize-y px-3 py-3 text-sm"
              />
            </label>
          </div>

          {submitError && (
            <p
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
              role="alert"
            >
              {submitError}
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            {refundMethod === 'CASH' ? <Banknote size={20} /> : <WalletCards size={20} />}
            <div>
              <p className="text-[0.68rem] font-bold text-slate-500">Total a reembolsar</p>
              <strong className="text-xl font-black tabular-nums text-slate-950 dark:text-white">
                {formatCurrency(refundTotal)}
              </strong>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              icon={<RotateCcw size={16} />}
              disabled={isSubmitting || !selectedItems.length || reason.trim().length < 3}
              className="flex-1 gap-2 sm:flex-none"
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar devolucion'}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
