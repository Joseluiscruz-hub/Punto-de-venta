# Guia UX - estado de implementacion

Esta nota traduce la guia `punto_de_venta_guia_mejoras.html` a cambios seguros dentro del prototipo actual. La regla fue: implementar lo que aporta valor inmediato sin romper GitHub Pages, y dejar una base clara para lo que necesita una fase mayor.

## Implementado ahora

- POS: busqueda con debounce para reducir renders al capturar o escanear codigos.
- POS: productos recientes como accesos rapidos para ventas repetitivas.
- POS: pago por transferencia activado en la interfaz; el modelo, API y migracion ya soportaban `TRANSFER`.
- Inventario: filtros por todos, bajo stock y agotados.
- Inventario: ordenamiento por descripcion, precio y stock.
- Inventario: doble clic sobre stock abre la edicion del producto como base solida para edicion inline.
- Dashboard: refresco automatico cada 60 segundos con hora de ultima actualizacion.
- Dashboard: comparativa de ingresos de hoy contra el dia anterior.
- Dashboard: ranking visual de productos vendidos cuando las ventas incluyen detalle de items.
- Recibos: base de impresion en formato 80mm y dialogos con semantica accesible.

## Iteracion adicional (junio 2026)

- Ventas: filtro por rango (Hoy, 7 dias, 30 dias, Todo), filtro por metodo de pago y busqueda por ticket, metodo o producto.
- Ventas: resumen de KPIs (transacciones, ingreso del periodo, ticket promedio, articulos) y exportacion del listado filtrado a CSV (con BOM para Excel).
- Dashboard: selector de periodo que recalcula ingresos, utilidad, transacciones, tendencia y top de productos.
- Recibo: precio unitario por linea, conteo de articulos y desglose de efectivo recibido/cambio en ventas en efectivo.
- POS: accion para vaciar el carrito desde el encabezado del checkout.

## Base preparada, pendiente de fase mayor

- Refactor por features (`features/pos`, `features/inventory`, `features/dashboard`): recomendable, pero requiere dividir `App.tsx`, actualizar imports y cubrir regresiones con pruebas de UI.
- Lazy loading y code splitting: conveniente despues del refactor por rutas/componentes.
- Zustand/SWR: util cuando haya cache remota real y pantallas separadas; por ahora el backend wrapper mantiene el prototipo simple.
- Virtualizacion de tablas: necesaria cuando el inventario supere miles de filas. La tabla ya tiene filtros/ordenamiento para preparar esa transicion.
- Command palette `Ctrl/Cmd+K`: buena mejora, pero conviene hacerla cuando la navegacion y permisos esten separados.
- Animaciones avanzadas con Framer Motion y confetti: descartadas por ahora para no aumentar bundle antes de estabilizar flujos criticos.
- QR real en recibo: requiere dependencia adicional o generador propio. La UI ya reserva el bloque visual del QR.
- Limpieza de assets grandes en `src/`: detectada, pero no eliminada a ciegas para evitar borrar material del usuario sin una auditoria dedicada.

## Siguiente fase recomendada

1. Extraer componentes por dominio y agregar pruebas de render para POS, inventario y cobro.
2. Introducir cache de datos con una libreria elegida y una politica clara de invalidacion.
3. Reemplazar el placeholder de QR por QR real del ticket.
4. Auditar y mover/eliminar imagenes pesadas que no se importen.
5. Medir bundle y rendimiento antes de agregar animaciones de terceros.
