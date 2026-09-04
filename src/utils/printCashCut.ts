import type { CashMovement, Shift } from '../models/types';
import { formatCurrency } from './helpers';

export interface CashCutPrintInput {
  shift: Shift;
  movements?: CashMovement[];
  storeName?: string;
  cashierName?: string;
  countedCashOverride?: number;
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtWhen(iso?: string): string {
  if (!iso) return 'En curso';
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function buildCashCutHtml(input: CashCutPrintInput): string {
  const { shift, movements = [], storeName, cashierName, countedCashOverride } = input;
  const counted =
    countedCashOverride ??
    (typeof shift.actualCash === 'number' ? shift.actualCash : undefined);
  const difference =
    typeof counted === 'number' ? counted - shift.expectedCash : shift.difference;

  const movementRows =
    movements.length === 0
      ? '<tr><td colspan="3">Sin movimientos de efectivo</td></tr>'
      : movements
          .map((m) => {
            const sign = m.type === 'CASH_IN' ? '+' : '-';
            const label = m.type === 'CASH_IN' ? 'Entrada' : 'Retiro';
            return `<tr>
              <td>${esc(label)} · ${esc(fmtWhen(m.createdAt))}</td>
              <td>${esc(m.reason)}</td>
              <td class="num">${sign}${esc(formatCurrency(m.amount))}</td>
            </tr>`;
          })
          .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Corte de caja ${esc(shift.id)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #fff;
    }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.04em; }
    .muted { color: #64748b; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 20px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .kpi span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .kpi strong { font-size: 18px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    .total { margin-top: 18px; border: 2px solid #0f172a; border-radius: 12px; padding: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .total span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .total strong { font-size: 20px; font-variant-numeric: tabular-nums; }
    .neg { color: #e11d48; }
    .pos { color: #059669; }
    @media print {
      body { padding: 0; }
      .noprint { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="noprint" onclick="window.print()" style="margin-bottom:16px;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;cursor:pointer">Imprimir</button>
  <h1>Corte de caja · El Triunfo</h1>
  <p class="muted">${esc(storeName || 'Sucursal')} · Turno ${esc(shift.id)}</p>
  <p class="muted">Apertura: ${esc(fmtWhen(shift.startTime))} · Cierre: ${esc(fmtWhen(shift.endTime))} · Cajero: ${esc(cashierName || shift.userId)} · Estado: ${esc(shift.status === 'CLOSED' ? 'Cerrado' : 'Abierto')}</p>

  <div class="grid">
    <div class="kpi"><span>Fondo inicial</span><strong>${esc(formatCurrency(shift.initialCash))}</strong></div>
    <div class="kpi"><span>Ventas efectivo</span><strong class="pos">+${esc(formatCurrency(shift.salesCash))}</strong></div>
    <div class="kpi"><span>Ventas tarjeta</span><strong>${esc(formatCurrency(shift.salesCard))}</strong></div>
    <div class="kpi"><span>Reembolsos efectivo</span><strong class="neg">-${esc(formatCurrency(shift.refundsCash))}</strong></div>
    <div class="kpi"><span>Entradas de caja</span><strong class="pos">+${esc(formatCurrency(shift.cashIn))}</strong></div>
    <div class="kpi"><span>Retiros de caja</span><strong class="neg">-${esc(formatCurrency(shift.cashOut))}</strong></div>
  </div>

  <div class="total">
    <div><span>Esperado</span><strong>${esc(formatCurrency(shift.expectedCash))}</strong></div>
    <div><span>Contado</span><strong>${typeof counted === 'number' ? esc(formatCurrency(counted)) : '—'}</strong></div>
    <div><span>Diferencia</span><strong class="${(difference || 0) < 0 ? 'neg' : 'pos'}">${typeof difference === 'number' ? esc(formatCurrency(difference)) : '—'}</strong></div>
  </div>

  <h2 style="font-size:14px;margin:24px 0 0">Movimientos de efectivo</h2>
  <table>
    <thead><tr><th>Tipo / hora</th><th>Motivo</th><th class="num">Monto</th></tr></thead>
    <tbody>${movementRows}</tbody>
  </table>

  <p class="muted" style="margin-top:28px">Documento generado por Punto de Venta El Triunfo. Conservar con el arqueo físico.</p>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
}

export function printCashCut(input: CashCutPrintInput): void {
  const html = buildCashCutHtml(input);
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!popup) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permite popups e inténtalo de nuevo.');
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
