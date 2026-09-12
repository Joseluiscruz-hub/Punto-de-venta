import { FileText } from 'lucide-react';
import type { Sale } from '../models/types';
import { Button } from './ui';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export function SaleInvoiceActions({
  sale,
  onStamp,
  compact = false,
}: {
  sale: Sale;
  onStamp: (sale: Sale) => void;
  compact?: boolean;
}) {
  const canStamp =
    (sale.invoiceStatus === 'NONE' || sale.invoiceStatus === 'ERROR') && Boolean(sale.clientId);
  if (compact) {
    if (!canStamp) return null;
    return (
      <button
        type="button"
        onClick={() => onStamp(sale)}
        className="table-action-button"
        aria-label={`Facturar ticket ${sale.id.slice(-8).toUpperCase()}`}
        title="Facturar CFDI"
      >
        <FileText size={16} />
      </button>
    );
  }
  if (!canStamp) return null;
  return (
    <Button
      variant="secondary"
      icon={<FileText size={16} />}
      onClick={() => onStamp(sale)}
      className="h-10 gap-2 px-3"
    >
      Facturar
    </Button>
  );
}

export { InvoiceStatusBadge };
