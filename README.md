# Punto de Venta El Triunfo

Base empresarial para el punto de venta El Triunfo. El repositorio contiene una PWA en React y una API Fastify que centraliza autenticacion, permisos y operaciones transaccionales sobre PostgreSQL.

## Incluido

- Empresas, sucursales, cajas y acceso de usuarios por sucursal.
- Roles `ADMIN`, `MANAGER` y `CASHIER` validados en el servidor.
- PIN almacenado con `scrypt`, bloqueo temporal por intentos fallidos y rate limiting.
- JWT de corta duracion y renovacion mediante cookie `HttpOnly` con rotacion.
- Catalogo, inventario por sucursal, clientes, turnos, ventas y movimientos.
- Ventas atomicas con bloqueo de existencias e idempotencia para sincronizacion offline.
- Devoluciones parciales auditadas con reversion atomica de inventario, reembolso en efectivo o
  saldo a favor y proteccion contra devoluciones duplicadas.
- Auditoria de operaciones administrativas y financieras.
- Migraciones SQL compatibles con PostgreSQL.
- PGlite para ejecutar PostgreSQL localmente sin instalar servicios adicionales.
- Docker Compose opcional para usar PostgreSQL convencional.

## Inicio local

```bash
npm install
npm run dev
```

Este comando inicia:

- API: `http://127.0.0.1:3001`
- Aplicacion: `http://127.0.0.1:5173`
- Base local persistente: `.data/postgres`

La API aplica migraciones y crea los datos provisionales durante el primer arranque.

## Acceso local provisional

| Organizacion | Usuario | PIN    | Rol           |
| ------------ | ------- | ------ | ------------- |
| `EL-TRIUNFO` | `admin` | `1234` | Administrador |
| `EL-TRIUNFO` | `caja1` | `0000` | Cajero        |

Estas credenciales solo se crean en desarrollo y pruebas. Una base de produccion vacia exige
`SEED_ADMIN_PIN` y `SEED_CASHIER_PIN` de al menos 6 caracteres; deben ser valores unicos y retirarse
del entorno despues de inicializar la base.

## PostgreSQL externo

1. Crea una base vacia.
2. Copia `.env.example` como `.env`.
3. Define `DATABASE_URL` y un `JWT_SECRET` aleatorio de al menos 32 caracteres.
4. Configura `WEB_ORIGIN` con el dominio HTTPS real. El arranque de produccion rechaza PGlite,
   origenes locales y el secreto JWT de desarrollo.
5. Ejecuta:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Con Docker disponible puede iniciarse la base incluida:

```bash
docker compose up -d postgres
```

Después usa `postgres://el_triunfo:local_change_me@127.0.0.1:5432/el_triunfo` como `DATABASE_URL` solo para desarrollo.

## Verificacion

```bash
npm test
npm run lint
npm run build
npm audit
```

El workflow de GitHub Pages ejecuta instalacion reproducible, lint, pruebas y compilacion de la API
antes de construir y desplegar la demo estatica.

## Devoluciones y reembolsos

Desde el historial de Ventas se puede registrar una devolucion parcial o total:

1. Selecciona los articulos y cantidades recibidas.
2. Elige reembolso en efectivo o saldo a favor. El saldo requiere una venta asociada a un cliente.
3. Captura el motivo y confirma la operacion.

La API bloquea la venta durante el proceso, evita devolver mas unidades de las vendidas, repone el
inventario, registra movimientos `RETURN` y genera el evento de auditoria `SALE_RETURNED`. Los
reembolsos en efectivo reducen el efectivo esperado y aparecen por separado en Corte de Caja.

La migracion `002_sales_returns.sql` crea el historial normalizado de devoluciones y agrega
`refunds_cash` a los turnos y `store_credit` a los clientes. Las migraciones se aplican
automaticamente al iniciar la API o manualmente con `npm run db:migrate`.

## Requisitos de produccion

Cuando `NODE_ENV=production`, la API no inicia si falta alguno de estos controles:

- `DATABASE_URL` hacia PostgreSQL externo.
- `JWT_SECRET` aleatorio de al menos 32 caracteres.
- `WEB_ORIGIN` con uno o mas origenes HTTPS reales.
- `SEED_ADMIN_PIN` y `SEED_CASHIER_PIN` al inicializar una base vacia.

Los PIN de inicializacion deben eliminarse del entorno despues de ejecutar el seed.

## Importacion de productos

El importador de inventario acepta archivos `.xlsx` con estas columnas:

```text
codigo, producto, categoria, imagen, Costo proveedor, Venta publico, Items, stock minimo
```

La columna `imagen` es opcional y puede contener una URL `https://...` o una ruta local publicada por la app, por ejemplo `/productos/genericos/001-arroz-blanco-1kg.webp`. Para catalogo local usa preferentemente `.webp`.

Para regenerar los derivados WebP despues de cambiar imagenes base:

```bash
npm run assets:optimize
```

El repositorio tambien incluye un catalogo inicial de 100 imagenes genericas sin marca en `public/productos/genericos`. La plantilla `public/productos/catalogo-generico.csv` ya trae nombre, categoria e imagen; puedes completar `codigo`, costos, precios e inventario y convertirla a `.xlsx` para importarla.

Para regenerar ese set generico:

```bash
npm run assets:generate-products
```

## Atajos de operacion

| Atajo          | Accion                            |
| -------------- | --------------------------------- |
| `F1`           | Enfocar la busqueda del catalogo  |
| `F10`          | Abrir el cobro de la venta actual |
| `Ctrl/Cmd + K` | Abrir la navegacion rapida        |
| `Ctrl/Cmd + J` | Cambiar entre tema claro y oscuro |

## Estructura

- `src/`: PWA y adaptadores de datos.
- `server/src/`: API, autenticacion, permisos y servicios.
- `server/migrations/`: esquema versionado de PostgreSQL.
- `docs/product-roadmap.md`: estado verificable y siguiente incremento del roadmap.
- `docker-compose.yml`: PostgreSQL opcional para desarrollo.
- `.env.example`: variables requeridas y valores de referencia.

## Modos del frontend

- `VITE_BACKEND_MODE=api`: usa la API empresarial. Es el modo de desarrollo predeterminado.
- `VITE_BACKEND_MODE=local`: conserva el backend en navegador solo para demostraciones estaticas.

El modo local no es apto para produccion ni trabajo multiusuario.

## Pendiente con datos reales

- Nombres, domicilios y horarios de sucursales.
- Cajas asignadas por sucursal.
- Usuarios definitivos y matriz de permisos.
- Datos fiscales y formato final del ticket.
- Catalogo real de productos.
- Politica de respaldos, hosting y dominio.
- Integracion CFDI/SAT si se confirma ese alcance.
