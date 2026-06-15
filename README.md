# Punto de Venta El Triunfo

Base empresarial para el punto de venta El Triunfo. El repositorio contiene una PWA en React y una API Fastify que centraliza autenticacion, permisos y operaciones transaccionales sobre PostgreSQL.

## Incluido

- Empresas, sucursales, cajas y acceso de usuarios por sucursal.
- Roles `ADMIN`, `MANAGER` y `CASHIER` validados en el servidor.
- PIN almacenado con `scrypt`, bloqueo temporal por intentos fallidos y rate limiting.
- JWT de corta duracion y renovacion mediante cookie `HttpOnly` con rotacion.
- Catalogo, inventario por sucursal, clientes, turnos, ventas y movimientos.
- Ventas atomicas con bloqueo de existencias e idempotencia para sincronizacion offline.
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

## Acceso provisional

| Organizacion | Usuario | PIN | Rol |
| --- | --- | --- | --- |
| `EL-TRIUNFO` | `admin` | `1234` | Administrador |
| `EL-TRIUNFO` | `caja1` | `0000` | Cajero |

Estos PIN deben cambiarse antes de publicar el sistema.

## PostgreSQL externo

1. Crea una base vacia.
2. Copia `.env.example` como `.env`.
3. Define `DATABASE_URL` y un `JWT_SECRET` aleatorio de al menos 32 caracteres.
4. Ejecuta:

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

## Estructura

- `src/`: PWA y adaptadores de datos.
- `server/src/`: API, autenticacion, permisos y servicios.
- `server/migrations/`: esquema versionado de PostgreSQL.
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
