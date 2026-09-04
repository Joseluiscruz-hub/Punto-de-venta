import { Printer, QrCode, X } from 'lucide-react';
import type { PaymentMethod, Sale } from '../../models/types';
import { formatCurrency } from '../../utils/helpers';
import { Button } from '../ui';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

function shortTicketId(id: string) {
  return id.slice(-8).toUpperCase();
}

function formatSaleDate(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function ReceiptModal({
  sale,
  onClose,
  storeName,
}: {
  sale: Sale;
  onClose: () => void;
  storeName: string;
}) {
  const electronicAmount =
    sale.paymentMethod === 'MIXED' ? Math.max(0, sale.total - sale.amountTendered) : 0;

  return (
    <div className="receipt-overlay fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm animate-fadeIn sm:p-6">
      <section
        className="modal-card receipt-dialog flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="receipt-print-sheet custom-scrollbar overflow-y-auto p-5 sm:p-7">
          <div className="mb-7 flex items-start justify-between">
            <div className="receipt-brand-mark">
              <QrCode size={23} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="top-icon-button no-print"
              aria-label="Cerrar comprobante"
            >
              <X size={19} />
            </button>
          </div>

          <div className="mb-7 text-center">
            <h2
              id="receipt-title"
              className="text-base font-extrabold text-slate-950 dark:text-white"
            >
              {storeName}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Comprobante simplificado de venta
            </p>
          </div>

          <dl className="receipt-metadata">
            <div>
              <dt>Fecha</dt>
              <dd>{formatSaleDate(sale.datetime)}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd className="font-mono">#{shortTicketId(sale.id)}</dd>
            </div>
            <div>
              <dt>Forma de pago</dt>
              <dd>{PAYMENT_LABELS[sale.paymentMethod]}</dd>
            </div>
            {sale.paymentMethod === 'CASH' && (
              <>
                <div>
                  <dt>Recibido</dt>
                  <dd>{formatCurrency(sale.amountTendered)}</dd>
                </div>
                <div>
                  <dt>Cambio</dt>
                  <dd>{formatCurrency(sale.changeAmount)}</dd>
                </div>
              </>
            )}
            {sale.paymentMethod === 'MIXED' && (
              <>
                <div>
                  <dt>Efectivo</dt>
                  <dd>{formatCurrency(sale.amountTendered)}</dd>
                </div>
                <div>
                  <dt>Pago electrónico</dt>
                  <dd>{formatCurrency(electronicAmount)}</dd>
                </div>
              </>
            )}
          </dl>

          <div className="receipt-items">
            <p className="receipt-items-title">Detalle de productos</p>
            {sale.items?.map((item) => (
              <div key={item.id} className="receipt-line-item">
                <div className="min-w-0 flex-1 pr-4">
                  <p>{item.name}</p>
                  <span>
                    {item.quantity} × {formatCurrency(item.price)}
                    {item.returnedQuantity > 0 ? ` · ${item.returnedQuantity} devueltas` : ''}
                  </span>
                </div>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
            ))}
            {!sale.items?.length && (
              <p className="py-3 text-center text-xs text-slate-500">
                Sin detalle de productos disponible.
              </p>
            )}
          </div>

          <div className="receipt-total">
            <div>
              <p>{sale.returnedTotal > 0 ? 'Total neto' : 'Total pagado'}</p>
              <span>
                {sale.itemsCount} artículos
                {sale.returnedTotal > 0 ? ` · ${formatCurrency(sale.returnedTotal)} devuelto` : ''}
              </span>
            </div>
            <strong>{formatCurrency(sale.total - sale.returnedTotal)}</strong>
          </div>
        </div>

        <div className="receipt-actions no-print">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Continuar
          </Button>
          <Button
            variant="primary"
            icon={<Printer size={17} />}
            onClick={() => {
              const cleanup = () => {
                document.body.classList.remove('printing-receipt');
                window.removeEventListener('afterprint', cleanup);
              };
              document.body.classList.add('printing-receipt');
              window.addEventListener('afterprint', cleanup);
              window.print();
              window.setTimeout(cleanup, 1000);
            }}
            className="flex-1 gap-2"
          >
            Imprimir ticket
          </Button>
        </div>
      </section>
    </div>
  );
}
