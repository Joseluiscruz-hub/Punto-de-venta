import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownCircle, ArrowLeftRight, CreditCard, Landmark, Wallet, X } from 'lucide-react';
import type { PaymentMethod } from '../../models/types';
import { formatCurrency } from '../../utils/helpers';
import { Button, IconButton, TextInput } from '../ui';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

export function PaymentModal({
  total,
  onConfirm,
  onClose,
}: {
  total: number;
  onConfirm: (m: PaymentMethod, a: number) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(total.toString());
  const quickAmounts = useMemo(() => {
    const rounded = Math.ceil(total / 50) * 50;
    return Array.from(new Set([total, rounded, rounded + 50, rounded + 100]));
  }, [total]);

  const paymentOptions: Array<{
    key: PaymentMethod;
    label: string;
    icon: ReactNode;
  }> = [
    { key: 'CASH', label: 'Efectivo', icon: <Wallet size={22} /> },
    { key: 'CARD', label: 'Tarjeta', icon: <CreditCard size={22} /> },
    { key: 'TRANSFER', label: 'Transferencia', icon: <Landmark size={22} /> },
    { key: 'MIXED', label: 'Mixto', icon: <ArrowLeftRight size={22} /> },
  ];

  const amountNum = parseFloat(amount) || 0;
  const requiresCashAmount = method === 'CASH' || method === 'MIXED';
  const amountTendered = requiresCashAmount ? amountNum : total;
  const change = amountNum - total;
  const mixedRemainder = Math.max(0, total - amountNum);
  const isInvalid =
    (method === 'CASH' && amountNum < total) ||
    (method === 'MIXED' && (amountNum <= 0 || amountNum >= total));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isInvalid) onConfirm(method, amountTendered);
        }}
        className="modal-card w-full max-w-lg p-5 animate-slideInUp sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Cobro</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">
              Finalizar venta
            </h2>
          </div>
          <IconButton onClick={onClose} label="Cerrar">
            <X size={19} />
          </IconButton>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {paymentOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                setMethod(option.key);
                setAmount(option.key === 'MIXED' ? '' : total.toString());
              }}
              type="button"
              className={`payment-option ${method === option.key ? 'payment-option-active' : ''}`}
            >
              {option.icon}
              <span className="text-xs font-bold">{option.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total</p>
              <p className="text-2xl font-extrabold text-slate-950 dark:text-white tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
            {requiresCashAmount ? (
              <div className="space-y-2">
                <label htmlFor="payment-amount" className="form-label">
                  {method === 'MIXED' ? 'Efectivo Recibido' : 'Monto Recibido'}
                </label>
                <TextInput
                  id="payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-14 w-full px-4 text-2xl font-extrabold tabular-nums"
                  autoFocus
                />
                {method === 'CASH' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAmount(value.toString())}
                        className={`quick-cash ${amountNum === value ? 'quick-cash-active' : ''}`}
                      >
                        {formatCurrency(value)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Cobro completo por {PAYMENT_LABELS[method].toLowerCase()}
              </div>
            )}
          </div>

          {method === 'CASH' && (
            <div
              className={`flex items-center justify-between border p-4 ${
                isInvalid
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowDownCircle size={20} />
                <p className="text-sm font-bold">{isInvalid ? 'Faltante' : 'Cambio a Entregar'}</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">
                {formatCurrency(Math.abs(change))}
              </p>
            </div>
          )}

          {method === 'MIXED' && (
            <div
              className={`flex items-center justify-between border p-4 ${
                isInvalid
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowLeftRight size={20} />
                <p className="text-sm font-bold">
                  {isInvalid ? 'Efectivo inválido' : 'Restante electrónico'}
                </p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">
                {formatCurrency(mixedRemainder)}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button variant="secondary" onClick={onClose} className="h-11 flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isInvalid} className="h-11 flex-1">
              Completar venta
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
