import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCashCutHtml } from '../utils/printCashCut';
import type { Shift } from '../models/types';

const shift: Shift = {
  id: 'shift-1',
  tenantId: 't1',
  storeId: 's1',
  userId: 'u1',
  startTime: '2026-09-04T15:00:00.000Z',
  endTime: '2026-09-04T23:00:00.000Z',
  initialCash: 1000,
  expectedCash: 1500,
  actualCash: 1490,
  difference: -10,
  status: 'CLOSED',
  salesCash: 600,
  salesCard: 200,
  refundsCash: 50,
  cashIn: 0,
  cashOut: 50,
  differenceThreshold: 50,
};

describe('buildCashCutHtml', () => {
  it('incluye totales y escape basico', () => {
    const html = buildCashCutHtml({
      shift,
      storeName: 'Sucursal <Centro>',
      cashierName: 'Caja 1',
      movements: [
        {
          id: 'm1',
          externalId: 'e1',
          tenantId: 't1',
          storeId: 's1',
          shiftId: 'shift-1',
          userId: 'u1',
          type: 'CASH_OUT',
          amount: 50,
          reason: 'Retiro <banco>',
          createdAt: '2026-09-04T18:00:00.000Z',
        },
      ],
    });
    assert.match(html, /\$1,500\.00/);
    assert.match(html, /Sucursal &lt;Centro&gt;/);
    assert.match(html, /Retiro &lt;banco&gt;/);
    assert.match(html, /Corte de caja/);
  });
});
