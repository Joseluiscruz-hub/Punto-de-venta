# Siguientes pasos para migrar y publicar en GitHub Pages

1. **Respalda tu código actual**
   - Haz una copia de seguridad de las carpetas `src/` y `public/`.

2. **Inicializa Vite en el proyecto**
   - Borra todos los archivos y carpetas excepto tu respaldo.
   - Ejecuta en la terminal:
     ```sh
     npm create vite@latest . -- --template react-ts
     ```
   - Cuando pregunte, elige la opción de **remover archivos existentes y continuar**.

3. **Restaura tu código**
   - Copia tu carpeta `src/` y `public/` de respaldo a la nueva estructura generada por Vite.
   - Asegúrate de que el entry point sea `main.tsx` y que importe tu `App.tsx`.

4. **Instala dependencias**
   - Ejecuta:
     ```sh
     npm install
     ```

5. **Prueba en desarrollo**
   - Ejecuta:
     ```sh
     npm run dev
     ```
   - Corrige cualquier error de importación o configuración.

6. **Configura el deploy a GitHub Pages**
   - Instala la dependencia:
     ```sh
     npm install --save-dev gh-pages
     ```
   - Agrega en `vite.config.ts`:
     ```ts
     import { defineConfig } from 'vite';
     import react from '@vitejs/plugin-react';

     export default defineConfig({
       plugins: [react()],
       base: '/NOMBRE_DEL_REPO/', // Cambia por el nombre real del repo
     });
     ```
   - En `package.json` agrega los scripts:
     ```json
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
     ```

7. **Publica en GitHub Pages**
   - Ejecuta:
     ```sh
     npm run deploy
     ```
   - Configura GitHub Pages para servir desde la rama `gh-pages`.

---

**Notas:**
- Si usas rutas, revisa el uso de `basename` en React Router.
- Si tienes assets estáticos, colócalos en `public/`.
- El enlace final será: `https://<usuario>.github.io/<repo>/`
