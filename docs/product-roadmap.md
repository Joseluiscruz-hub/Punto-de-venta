# Roadmap de producto

Este documento traduce el roadmap funcional a incrementos verificables. Los estados se basan en
el codigo actual; una tarea solo se marca como completada cuando tiene persistencia, autorizacion,
auditoria y pruebas automatizadas cuando corresponda.

## Sprint 1: operacion segura

- [ ] Corte de caja (avance parcial):
  - [x] turno activo, efectivo esperado, arqueo, diferencia e historial;
  - [x] devoluciones en efectivo visibles y descontadas del esperado;
  - [x] retiros/entradas de efectivo con motivo, idempotencia y auditoria;
  - [x] umbral de diferencia configurable y confirmacion auditada;
  - [x] reporte imprimible del corte.
- [x] Devoluciones parciales:
  - reversion atomica de inventario;
  - control de cantidades ya devueltas;
  - reembolso en efectivo o saldo a favor del cliente;
  - afectacion del efectivo esperado y visibilidad en el corte;
  - evento de auditoria y pruebas de API/backend local.
- [x] Guardas de configuracion de produccion:
  - `JWT_SECRET` no predeterminado;
  - PostgreSQL externo obligatorio;
  - `WEB_ORIGIN` sin origenes locales;
  - PIN de usuarios iniciales recibido por variables de entorno y nunca fijado en produccion.
- [ ] Datos reales de sucursales, cajas, usuarios, dominio, politicas de respaldo y secretos.
      Esta actividad depende de la infraestructura elegida y no debe resolverse con valores simulados.

## Sprint 2: cumplimiento fiscal

- [ ] Definir proveedor PAC y contrato de servicio.
- [ ] Modelo fiscal del emisor, receptor y productos.
- [ ] Generacion, almacenamiento y cancelacion de CFDI 4.0.
- [ ] Entrega segura de XML/PDF y pruebas en ambiente sandbox del PAC.

## Sprint 3: promociones

- [ ] Descuentos por producto, categoria y total de compra.
- [ ] Vigencia, limites de uso y cupones.
- [ ] Autorizacion de descuentos manuales y detalle en ticket.

## Sprint 4: supervision y recibos digitales

- [x] Vista de auditoria con filtros y exportacion.
- [ ] Metricas por cajero y reglas de actividad sospechosa.
- [ ] Envio idempotente de ticket por email o WhatsApp.

## Sprint 5: abastecimiento

- [ ] Proveedores y ordenes de compra.
- [ ] Recepcion parcial/total con movimiento de inventario.
- [ ] Sugerencias de reorden por `min_stock`.

## Fortalecimiento tecnico continuo

- [x] Carga diferida de vistas con `React.lazy` y `Suspense`.
- [ ] Separacion progresiva por `features/` en lugar de una migracion masiva.
- [ ] Cache y sincronizacion de servidor con TanStack Query.
- [ ] Flujos E2E con Playwright y accesibilidad automatizada.
- [ ] QR verificable en recibo y pagina publica de solo lectura.

## Criterio para el siguiente incremento

El Sprint 1 operativo queda cubierto en codigo (incluido el reporte imprimible del corte). El
siguiente incremento recomendado es preparar datos reales de sucursales/usuarios/hosting o, si ya
existen, avanzar metricas por cajero. Antes de iniciar CFDI se deben proporcionar o elegir:
PAC, ambiente sandbox, datos fiscales de prueba, politica de almacenamiento de XML/PDF y
responsable del certificado.
