# Plan de modernizacion de diseno

Fecha: 2026-07-29

## Objetivo

Elevar la aplicacion de punto de venta a un estandar profesional y corporativo sin sacrificar velocidad operativa, estabilidad offline ni mantenibilidad. La prioridad no es "verse moderna" en abstracto: es que cajeros, encargados y administradores puedan vender, revisar inventario y tomar decisiones con menos friccion.

## Principios de producto

- Operacion primero: cada pantalla debe optimizar tareas repetidas, lectura rapida y accion inmediata.
- Consistencia antes que decoracion: mismos tokens, espaciados, bordes, estados y patrones para todos los modulos.
- Densidad controlada: mas informacion util por pantalla, sin saturar ni crear jerarquias confusas.
- Accesibilidad WCAG 2.2 AA como piso: foco visible, contraste, nombres accesibles, objetivos tactiles y formularios entendibles.
- Rendimiento medible: cada mejora visual debe pasar build, pruebas y revision de bundle antes de entrar a `main`.

## Stack recomendado

El stack actual ya esta bien alineado para 2026: React 19, Vite 8, Tailwind CSS 4, TypeScript y Fastify. La estrategia recomendada es evolucionarlo, no reemplazarlo.

- React 19: mantener componentes funcionales y preparar adopcion gradual de React Compiler cuando el lint/reglas de React esten limpios.
- Tailwind CSS 4: consolidar tokens con `@theme` y variables CSS para colores, radios, sombras, espaciado y estados.
- Vite 8: conservar lazy loading por vistas, revisar chunks pesados y aprovechar mejoras de build sin migraciones innecesarias.
- Recharts: mantener por ahora, pero envolver graficas en componentes propios para poder cambiar libreria despues si el bundle lo exige.
- Pruebas: sumar Playwright para flujos criticos y capturas visuales; sumar axe o equivalente para auditorias de accesibilidad.

## Fase 1 - Sistema de diseno base

Entregables:

- Crear una capa de componentes compartidos en `src/components/ui`.
- Definir componentes base: `Button`, `IconButton`, `Input`, `Select`, `SegmentedControl`, `Badge`, `Panel`, `DataTable`, `Modal` y `EmptyState`.
- Migrar clases repetidas de pantallas a esos componentes.
- Documentar tokens principales: color, tipografia, radios, sombras, focus ring, estados semanticos y densidad.

Criterios de aceptacion:

- Ninguna pantalla define estilos visuales primarios de forma aislada si ya existe componente base.
- Todos los botones icono tienen `aria-label` o tooltip visible.
- Estados `hover`, `focus`, `disabled`, `loading` y error son consistentes.

## Fase 2 - POS operativo

Entregables:

- Mejorar flujo de venta para escritorio, tablet y tactil.
- Separar `ProductGrid`, `ProductCard`, `CartDrawer`, `PaymentModal`, `ClientSelector` y `OfflineBanner`.
- Agregar estados de carga por seccion y errores recuperables.
- Revisar tamanos tactiles, atajos de teclado y lectura por scanner.

Criterios de aceptacion:

- Agregar producto, cambiar cantidades y cobrar no genera saltos de layout.
- El carrito mantiene legibilidad con muchos articulos.
- El modo offline comunica claramente que la venta quedo en cola.
- Prueba Playwright cubre venta basica con efectivo.

## Fase 3 - Inventario profesional

Entregables:

- Convertir la tabla actual en `DataTable` reutilizable con ordenamiento, estado vacio y acciones.
- Agregar panel de salud de inventario: bajo stock, agotados, valor, margen estimado.
- Mejorar formulario con validacion por campo, mensajes claros y prevencion de valores invalidos.
- Preparar virtualizacion cuando el catalogo supere miles de productos.

Criterios de aceptacion:

- Tabla usable en mobile sin ocultar acciones criticas.
- Importacion Excel reporta errores por fila de forma clara.
- Edicion y eliminacion conservan confirmaciones accesibles.

## Fase 4 - Dashboard ejecutivo

Entregables:

- Crear componentes `KpiGrid`, `TrendChart`, `CategoryMix`, `TopProducts` y `InventoryAlerts`.
- Unificar formato de fechas y dinero.
- Agregar skeletons reales para graficas.
- Medir y reducir el chunk del dashboard si supera el presupuesto definido.

Criterios de aceptacion:

- El dashboard responde rapido aunque Recharts sea lazy-loaded.
- Cada metrica tiene definicion y periodo visible.
- No hay graficas vacias sin explicacion.

## Fase 5 - Calidad visual y accesibilidad

Entregables:

- Auditoria WCAG 2.2 AA de login, POS, inventario, dashboard y modales.
- Pruebas visuales con Playwright en 390px, 768px, 1366px y 1920px.
- Revisar contraste en modo claro y oscuro.
- Estandarizar copy de errores, confirmaciones y acciones destructivas.

Criterios de aceptacion:

- Sin texto cortado en botones, tablas, modales o tarjetas.
- Navegacion por teclado completa en flujos principales.
- Focus visible en controles interactivos.
- Capturas de regresion visual aprobadas antes de merge.

## Fase 6 - Performance y deuda tecnica

Entregables:

- Revisar `npm audit` de devDependencies en PR separado.
- Evaluar upgrades mayores: ESLint 10, TypeScript 7, Recharts 3, lucide-react 1.
- Medir bundle con reporte de chunks.
- Auditar assets grandes y mover/eliminar recursos no usados.
- Evaluar React Compiler despues de limpiar patrones incompatibles.

Criterios de aceptacion:

- `npm run lint`, `npm test` y `npm run build` pasan.
- `npm audit --omit=dev` se mantiene limpio.
- Cualquier major upgrade queda aislado por PR y con notas de migracion.

## Orden recomendado de PRs

1. `agent/ui-components-base`: componentes UI compartidos y tokens documentados.
2. `agent/pos-operativo`: refactor visual del POS con pruebas de flujo de venta.
3. `agent/inventario-data-table`: tabla reusable, filtros y formularios mejorados.
4. `agent/dashboard-ejecutivo`: componentes de analitica, skeletons y medicion de chunk.
5. `agent/a11y-visual-qa`: Playwright, capturas y auditoria WCAG 2.2.
6. `agent/upgrade-tooling`: dependencias mayores y auditoria dev.

## Riesgos y mitigaciones

- Riesgo: subir dependencias mayores junto con redisenos visuales.
  Mitigacion: separar upgrades de tooling en PR propio.
- Riesgo: afectar velocidad del POS por componentes demasiado abstractos.
  Mitigacion: medir interacciones clave y evitar abstracciones en caliente hasta tener pruebas.
- Riesgo: dark mode inconsistente.
  Mitigacion: todos los componentes base deben depender de tokens, no de colores sueltos.
- Riesgo: dashboard pesado por libreria de graficas.
  Mitigacion: lazy loading por vista, wrapper propio de graficas y presupuesto de bundle.

## Referencias oficiales consultadas

- React Compiler: https://react.dev/learn/react-compiler
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- Tailwind theme variables: https://tailwindcss.com/docs/theme
- Vite 8: https://vite.dev/blog/announcing-vite8
- Vite build options: https://vite.dev/config/build-options
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
