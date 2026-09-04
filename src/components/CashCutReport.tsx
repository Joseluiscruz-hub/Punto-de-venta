import type { CashMovement, Shift } from '../models/types';
import { formatCurrency } from '../utils/helpers';
import '../styles/cash-cut-print.css';

function formatDateTime(value?: string) {
  if (!value) return 'En curso';
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function CashCutReport({
  shift,
  movements,
  storeName,
  cashierName,
  generatedAt = new Date(),
}: {
  shift: Shift;
  movements: CashMovement[];
  storeName: string;
  cashierName?: string;
  generatedAt?: Date;
}) {
  const difference =
    shift.difference ??
    (shift.actualCash !== undefined ? shift.actualCash - shift.expectedCash : undefined);

  return (
    <article className="cash-cut-print-sheet" aria-label="Reporte de corte de caja">
      <header className="cash-cut-header">
        <div>
          <p className="cash-cut-kicker">El Triunfo · Punto de venta</p>
          <h2>Reporte de corte de caja</h2>
          <p>{storeName}</p>
        </div>
        <div className="cash-cut-meta">
          <p>
            <strong>Turno:</strong> {shift.id.slice(-8).toUpperCase()}
          </p>
          <p>
            <strong>Estado:</strong> {shift.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
          </p>
          <p>
            <strong>Generado:</strong>{' '}
            {generatedAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </header>

      <section className="cash-cut-grid">
        <div>
          <span>Apertura</span>
          <strong>{formatDateTime(shift.startTime)}</strong>
        </div>
        <div>
          <span>Cierre</span>
          <strong>{formatDateTime(shift.endTime)}</strong>
        </div>
        <div>
          <span>Cajero / responsable</span>
          <strong>{cashierName ?? shift.userId}</strong>
        </div>
        <div>
          <span>Umbral de diferencia</span>
          <strong>{formatCurrency(shift.differenceThreshold)}</strong>
        </div>
      </section>

      <section className="cash-cut-totals">
        <div>
          <span>Fondo inicial</span>
          <strong>{formatCurrency(shift.initialCash)}</strong>
        </div>
        <div>
          <span>Ventas en efectivo</span>
          <strong>+{formatCurrency(shift.salesCash)}</strong>
        </div>
        <div>
          <span>Ventas tarjeta / electrónico</span>
          <strong>{formatCurrency(shift.salesCard)}</strong>
        </div>
        <div>
          <span>Cantidad de ventas</span>
          <strong>{shift.salesCount ?? 0}</strong>
        </div>
        <div>
          <span>Reembolsos en efectivo</span>
          <strong>-{formatCurrency(shift.refundsCash)}</strong>
        </div>
        <div>
          <span>Entradas de caja</span>
          <strong>+{formatCurrency(shift.cashIn)}</strong>
        </div>
        <div>
          <span>Retiros de caja</span>
          <strong>-{formatCurrency(shift.cashOut)}</strong>
        </div>
        <div className="cash-cut-emphasis">
          <span>Efectivo esperado</span>
          <strong>{formatCurrency(shift.expectedCash)}</strong>
        </div>
        <div className="cash-cut-emphasis">
          <span>Efectivo contado</span>
          <strong>{formatCurrency(shift.actualCash ?? 0)}</strong>
        </div>
        <div className="cash-cut-emphasis">
          <span>Diferencia</span>
          <strong className={(difference ?? 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}>
            {formatCurrency(difference ?? 0)}
          </strong>
        </div>
      </section>

      <section>
        <h3>Movimientos de efectivo del turno</h3>
        {movements.length === 0 ? (
          <p className="cash-cut-empty">Sin entradas ni retiros registrados.</p>
        ) : (
          <table className="cash-cut-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>
                    {new Date(movement.createdAt).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>{movement.type === 'CASH_IN' ? 'Entrada' : 'Retiro'}</td>
                  <td>{movement.reason}</td>
                  <td>
                    {movement.type === 'CASH_IN' ? '+' : '-'}
                    {formatCurrency(movement.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="cash-cut-footer">
        <div>
          <p>Firma cajero</p>
          <span />
        </div>
        <div>
          <p>Firma supervisor</p>
          <span />
        </div>
      </footer>
    </article>
  );
}
