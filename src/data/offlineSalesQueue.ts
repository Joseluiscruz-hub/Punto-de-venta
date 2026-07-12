import type { PaymentMethod, ProcessSaleInput, RequestContext } from '../models/types';

export interface OfflineSaleRecord {
  saleId: string;
  reqContext: RequestContext;
  saleData: ProcessSaleInput;
}

const OFFLINE_SALES_KEY = 'offline_sales';
export const OFFLINE_SALES_CHANGED = 'el-triunfo:offline-sales-updated';

const PAYMENT_METHODS = new Set<PaymentMethod>(['CASH', 'CARD', 'TRANSFER', 'MIXED']);

interface OfflineSalesState {
  version: 1;
  records: OfflineSaleRecord[];
}

function emitQueueChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_SALES_CHANGED));
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRequestContext(value: unknown): value is RequestContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestContext>;
  return isString(candidate.tenantId) && isString(candidate.storeId) && isString(candidate.userId);
}

function isSaleData(value: unknown): value is ProcessSaleInput {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProcessSaleInput>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        isString((item as { id?: unknown }).id) &&
        Number.isInteger((item as { quantity?: unknown }).quantity) &&
        Number((item as { quantity?: unknown }).quantity) > 0,
    ) &&
    PAYMENT_METHODS.has(candidate.paymentMethod as PaymentMethod) &&
    typeof candidate.amountTendered === 'number' &&
    Number.isFinite(candidate.amountTendered) &&
    candidate.amountTendered >= 0
  );
}

function isOfflineSaleRecord(value: unknown): value is OfflineSaleRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OfflineSaleRecord>;
  return (
    isString(candidate.saleId) &&
    isRequestContext(candidate.reqContext) &&
    isSaleData(candidate.saleData)
  );
}

function parseOfflineSales(raw: string | null): OfflineSaleRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const records = Array.isArray(parsed)
      ? parsed
      : (parsed as Partial<OfflineSalesState>)?.version === 1
        ? (parsed as Partial<OfflineSalesState>).records
        : [];
    return Array.isArray(records) ? records.filter(isOfflineSaleRecord) : [];
  } catch {
    return [];
  }
}

function writeOfflineSales(records: OfflineSaleRecord[]) {
  const state: OfflineSalesState = { version: 1, records };
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(state));
  emitQueueChanged();
}

function updateOfflineSales(
  transform: (records: OfflineSaleRecord[]) => OfflineSaleRecord[],
): OfflineSaleRecord[] {
  const next = transform(readOfflineSales());
  writeOfflineSales(next);
  return next;
}

export function readOfflineSales(): OfflineSaleRecord[] {
  const records = parseOfflineSales(localStorage.getItem(OFFLINE_SALES_KEY));
  const raw = localStorage.getItem(OFFLINE_SALES_KEY);
  if (raw && !raw.trim().startsWith('{')) writeOfflineSales(records);
  return records;
}

export function enqueueOfflineSale(record: OfflineSaleRecord) {
  updateOfflineSales((records) => {
    if (records.some((existing) => existing.saleId === record.saleId)) return records;
    return [...records, record];
  });
}

export function reconcileOfflineSales(
  attemptedIds: Set<string>,
  failedRecords: OfflineSaleRecord[],
) {
  const failedById = new Map(failedRecords.map((record) => [record.saleId, record]));
  return updateOfflineSales((records) =>
    records.flatMap((record) => {
      if (!attemptedIds.has(record.saleId)) return [record];
      const failed = failedById.get(record.saleId);
      return failed ? [failed] : [];
    }),
  );
}
