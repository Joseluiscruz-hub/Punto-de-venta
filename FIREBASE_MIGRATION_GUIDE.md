# Guía de Migración Completa a Firebase

Esta guía te ayuda a completar la migración del backend simulado en `App.tsx` hacia Firebase.

## Archivos ya creados

- `src/lib/firebase.ts` - Configuración de Firebase
- `src/lib/firebaseAPI.ts` - API con métodos básicos de Firebase
- `.github/workflows/deploy.yml` - Deploy automático con GitHub Actions

## Pasos para completar la migración

### 1. Instalar Firebase localmente

```bash
cd Punto-de-venta
npm install firebase
```

### 2. Crear `.env.local` en la raíz

```env
VITE_FIREBASE_API_KEY=a"aqui va la api key de gemini(consigue una en google IA estudio)"
VITE_FIREBASE_AUTH_DOMAIN=punto-de-venta-8c638.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=punto-de-venta-8c638
VITE_FIREBASE_STORAGE_BUCKET=punto-de-venta-8c638.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1065377049887
VITE_FIREBASE_APP_ID=1:1065377049887:web:27bb6376025ae0e711d42a
```

### 3. Editar `src/App.tsx`

#### Paso 3.1 - Reemplazar imports (línea ~25)

Elimina todo desde la línea 28 hasta antes de `function App()` (todo el let DB y const BackendAPI).

En su lugar, agrega al final de los imports:

```typescript
// REEMPLAZO: BackendAPI simulado por Firebase real
import * as BackendAPI from './lib/firebaseAPI';
```

#### Paso 3.2 - Usar el mismo BackendAPI

El resto del código permanece IGUAL. Como tu `firebaseAPI.ts` exporta funciones con los mismos nombres (`login`, `getStoreProducts`, `saveProduct`, etc.), el componente `App` funcionará sin cambios.

### 4. Configurar GitHub Secrets

Ve a: **Settings → Secrets and variables → Actions → New repository secret**

Agrega estas 6 variables:

| Name | Secret |
|------|--------|
| VITE_FIREBASE_API_KEY | AIzaSyAliLc5bsB-eEom9xqB82zTCBsmJuJIzcE |
| VITE_FIREBASE_AUTH_DOMAIN | punto-de-venta-8c638.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | punto-de-venta-8c638 |
| VITE_FIREBASE_STORAGE_BUCKET | punto-de-venta-8c638.firebasestorage.app |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 1065377049887 |
| VITE_FIREBASE_APP_ID | 1:1065377049887:web:27bb6376025ae0e711d42a |

### 5. Crear datos iniciales en Firebase

#### Usuario admin
Firebase Console → Authentication → Add user:
- Email: `admin@eltriunfo.local`
- Password: `1234`

Firestore → `users` collection → documento con UID del usuario:
```json
{
  "username": "admin",
  "role": "admin",
  "tenantId": "t1",
  "storeId": "s1",
  "name": "Administrador"
}
```

#### Productos de prueba (opcional)

Firestore → `products` collection:
```json
{
  "tenantId": "t1",
  "storeId": "s1",
  "barcode": "75010001",
  "name": "Coca-Cola 600ml",
  "category": "Bebidas",
  "cost": 10,
  "price": 15,
  "stock": 50,
  "minStock": 10
}
```

### 6. Deploy automático

Cuando hagas `git push` a `main`, GitHub Actions:
1. Instalará dependencias
2. Hará build con las variables de entorno de Firebase
3. Desplegará a GitHub Pages automáticamente

## Troubleshooting

- Si hay errores de autenticación, verifica que el usuario exista en Firebase Auth Y en Firestore/users
- Si los productos no cargan, verifica que tengan los campos `tenantId` y `storeId`
- Si el deploy falla, verifica que las GitHub Secrets estén correctamente configuradas
