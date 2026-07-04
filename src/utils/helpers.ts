import { Tenant, Feature } from '../models/types';

export function hasFeature(tenant: Tenant | null, feature: Feature) {
  if (!tenant) return false;
  const planFeatures: Record<Tenant['plan'], Feature[]> = {
    BASIC: ['POS', 'INVENTORY'],
    PRO: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT'],
    PREMIUM: ['POS', 'INVENTORY', 'MULTISTORE', 'AUDIT', 'OFFLINE', 'API'],
  };
  return planFeatures[tenant.plan].includes(feature);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createOfflineId() {
  return `OFF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function productInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'ET'
  );
}

export function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function startOfPeriod(period: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL'): number {
  if (period === 'ALL') return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'WEEK') start.setDate(start.getDate() - 6);
  if (period === 'MONTH') start.setDate(start.getDate() - 29);
  return start.getTime();
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);

export const PERIOD_OPTIONS: Array<{ key: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL'; label: string }> = [
  { key: 'TODAY', label: 'Hoy' },
  { key: 'WEEK', label: '7 dias' },
  { key: 'MONTH', label: '30 dias' },
  { key: 'ALL', label: 'Todo' },
];
