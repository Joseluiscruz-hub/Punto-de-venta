import type { InvoiceStatus, Sale } from '../models/types';
import { StatusBadge } from './ui';

export function InvoiceStatusBadge({ sale }: { sale: Sale }) {
  const status: InvoiceStatus = sale.invoiceStatus ?? 'NONE';
  const labels: Record<InvoiceStatus, string> = {
    NONE: 'Sin CFDI',
    PENDING_GLOBAL: 'Cola global',
    STAMPED: 'Timbrada',
    ERROR: 'Error CFDI',
    CREDIT_NOTE: 'Nota crédito',
  };
  const tone =
    status === 'STAMPED'
      ? 'success'
      : status === 'PENDING_GLOBAL'
        ? 'warning'
        : status === 'ERROR'
          ? 'danger'
          : 'neutral';
  return (
    <StatusBadge tone={tone} title={sale.invoiceError ?? sale.invoiceUuid}>
      {labels[status]}
    </StatusBadge>
  );
}
